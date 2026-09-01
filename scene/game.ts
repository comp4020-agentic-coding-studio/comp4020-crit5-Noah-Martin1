// State, physics, waves and input.
//
// The rules themselves live in rules.ts so they can be tested without a canvas;
// this file is the machine that runs them over time.

import type { Rng } from "./rng.ts";
import { makeRng } from "./rng.ts";
import {
  BLAST_DELAY,
  BURROW_AT,
  GRAVITY,
  GROUND_Y,
  JUMP_V,
  LEVEL_LEN,
  RUN_SPEED,
  RUN_TIME,
  START_X,
  WAVE,
  WAVE_AT,
  WAVE_STRENGTH,
} from "./layout.ts";
import type { Prop } from "./layout.ts";
import { blockedBy, burrowInReach, clampX, shelteredBy, trapAt } from "./rules.ts";
import { launchX, makeWaves } from "./shockwave.ts";
import type { Wave } from "./shockwave.ts";
import { makeBlast } from "./blast.ts";
import type { Blast } from "./blast.ts";

export type Phase = "idle" | "running" | "escaped" | "lost";
/** What ended the run. The clock is swallowed by the blast; a trap is not. */
export type Death = "clock" | "trap" | null;

export type Rabbit = {
  x: number;
  facing: number;
  vx: number;
  lift: number;
  vy: number;
  gait: number;
  airborne: boolean;
  /** Progress through a skid turn, 0 when not turning. */
  skid: number;
  /** Facing as a continuous value. Passes through 0 — the rabbit goes
   *  edge-on and comes back out the other way, so a turn is a movement
   *  the animal makes rather than the sprite being mirrored. */
  turn: number;
  dive: number;
  /** Seconds left face-down after a wave caught you in the open. */
  stun: number;
  /** Seconds left of the crouch behind cover. */
  flinch: number;
  /** Seconds left of the stumble after running into an obstacle. */
  stumble: number;
};

export type Game = {
  phase: Phase;
  phaseT: number;
  t: number;
  /** Seconds since the player first moved; drives the detonation. */
  sinceStart: number;
  started: boolean;
  blast: Blast;
  /** Seconds left on the clock. Only meaningful once the blast has gone. */
  timeLeft: number;
  waves: Wave[];
  death: Death;
  rabbit: Rabbit;
  /** Screen shake, in frame-heights, decaying. */
  shake: number;
  fade: number;
  rng: Rng;
};

const SKID_TIME = 0.28;
const ACCEL = RUN_SPEED / 0.3;
const STRIDE = 0.19;
const DIVE_TIME = 0.7;
const STUMBLE_TIME = 0.35;
export const FLINCH_TIME = 0.9;
const END_HOLD = 1.1;

export const RABBIT_HALF = 0.028;

export function makeGame(seed: number): Game {
  return {
    phase: "idle",
    phaseT: 0,
    t: 0,
    sinceStart: 0,
    started: false,
    blast: makeBlast(),
    timeLeft: RUN_TIME,
    waves: makeWaves(WAVE_AT, WAVE_STRENGTH),
    death: null,
    rabbit: freshRabbit(),
    shake: 0,
    fade: 0,
    rng: makeRng(seed),
  };
}

function freshRabbit(): Rabbit {
  return {
    x: START_X, facing: 1, vx: 0, lift: 0, vy: 0, gait: 0,
    airborne: false, skid: 0, turn: 1, dive: 0, stun: 0, flinch: 0, stumble: 0,
  };
}

export function reset(game: Game): void {
  game.phase = "idle";
  game.phaseT = 0;
  game.sinceStart = 0;
  game.started = false;
  game.blast = makeBlast();
  game.timeLeft = RUN_TIME;
  game.waves = makeWaves(WAVE_AT, WAVE_STRENGTH);
  game.death = null;
  game.rabbit = freshRabbit();
  game.shake = 0;
}

export type Input = {
  left: boolean;
  right: boolean;
  jumpEdge: boolean;
  diveEdge: boolean;
  anyEdge: boolean;
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export function update(game: Game, input: Input, dt: number): void {
  game.t += dt;
  game.phaseT += dt;
  game.shake = Math.max(0, game.shake - dt * 2.4);
  const r = game.rabbit;

  if (game.phase === "idle") {
    // Nothing is announced. The scene simply waits, and the first thing the
    // player does starts the clock they do not yet know exists.
    if (input.left || input.right || input.jumpEdge) {
      game.phase = "running";
      game.phaseT = 0;
      game.started = true;
      game.sinceStart = 0;
    }
    game.fade = Math.max(0, game.fade - dt / 0.8);
    return;
  }

  if (game.phase === "escaped" || game.phase === "lost") {
    if (game.phase === "escaped") r.dive = clamp(game.phaseT / DIVE_TIME, 0, 1);
    // The blast does not care that the run is over.
    stepBlast(game, dt);
    for (const w of game.waves) if (w.launched) w.x += WAVE.speed * dt;
    if (game.death === "trap") game.fade = Math.min(1, game.fade + dt / 1.3);
    if (input.anyEdge && game.phaseT > END_HOLD + 0.6) reset(game);
    return;
  }

  // --- running --------------------------------------------------------------
  game.sinceStart += dt;
  stepBlast(game, dt);

  if (game.blast.t !== null) {
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    if (game.timeLeft <= 0) {
      game.phase = "lost";
      game.death = "clock";
      game.phaseT = 0;
      game.shake = 0.05;
      return;
    }
  }

  stepWaves(game, dt);

  // Being face-down costs you the only thing that matters, which is time.
  if (r.stun > 0) {
    r.stun -= dt;
    r.vx = approach(r.vx, 0, ACCEL * 0.6 * dt);
    r.x = clampX(r.x + r.vx * dt);
    return;
  }
  // The body catches up with the decision over one skid.
  r.turn = approach(r.turn, r.facing, (2 / SKID_TIME) * dt);
  if (r.flinch > 0) r.flinch -= dt;
  if (r.stumble > 0) r.stumble -= dt;

  const dir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;

  if (r.skid > 0) {
    r.skid = Math.max(0, r.skid - dt / SKID_TIME);
    const p = 1 - r.skid;
    r.vx = approach(r.vx, r.facing * RUN_SPEED, ACCEL * 2.2 * dt);
    if (p > 0.5 && r.facing !== Math.sign(r.vx || r.facing)) r.vx = r.facing * Math.abs(r.vx);
  } else if (dir !== 0 && dir !== r.facing && Math.abs(r.vx) > RUN_SPEED * 0.35 && !r.airborne) {
    r.skid = 1;
    r.facing = dir;
    r.vx *= 0.35;
  } else {
    const target = dir * RUN_SPEED * (r.stumble > 0 ? 0.25 : 1);
    r.vx = approach(r.vx, target, ACCEL * dt);
    if (dir !== 0) r.facing = dir;
  }

  if (input.jumpEdge && !r.airborne) {
    r.vy = JUMP_V;
    r.airborne = true;
  }

  if (r.airborne) {
    r.vy -= GRAVITY * dt;
    r.lift += r.vy * dt;
    if (r.lift <= 0) {
      r.lift = 0;
      r.vy = 0;
      r.airborne = false;
    }
  }

  // Move, then let an obstacle veto the move. Resolving it this way means a
  // rabbit can never end a frame inside a log.
  const wantX = clampX(r.x + r.vx * dt);
  const feetY = GROUND_Y - r.lift;
  const hit = blockedBy(wantX, RABBIT_HALF, feetY);
  if (hit && Math.sign(wantX - r.x) === Math.sign(hit.x - r.x)) {
    r.vx = 0;
    if (r.stumble <= 0) r.stumble = STUMBLE_TIME;
  } else {
    r.x = wantX;
  }

  r.gait += (Math.abs(r.vx) * dt) / STRIDE;
  if (r.gait > 1) r.gait -= Math.floor(r.gait);

  // Underfoot, and instant. A trap is the one thing in the field that does not
  // cost you time — it costs you the run.
  const sprung = trapAt(r.x, RABBIT_HALF, GROUND_Y - r.lift);
  if (sprung) {
    game.phase = "lost";
    game.death = "trap";
    game.phaseT = 0;
    game.shake = 0.06;
    return;
  }

  if (burrowInReach(r.x) && !r.airborne) {
    game.phase = "escaped";
    game.phaseT = 0;
  }
}

function stepBlast(game: Game, dt: number): void {
  if (game.blast.t === null) {
    if (game.started && game.sinceStart >= BLAST_DELAY) {
      game.blast.t = 0;
      game.shake = 0.04;
    }
    return;
  }
  game.blast.t += dt;
  game.blast.flare = Math.max(0, game.blast.flare - dt * 1.4);
}

function stepWaves(game: Game, dt: number): void {
  const r = game.rabbit;
  const elapsed = RUN_TIME - game.timeLeft;

  for (const w of game.waves) {
    if (!w.launched) {
      if (game.blast.t === null || elapsed < w.at - WAVE.warn) continue;
      // Launched from wherever it has to be to arrive on schedule, and the
      // fireball flares at the same instant — that flare is the only warning.
      w.launched = true;
      w.x = launchX(r.x, RUN_SPEED);
      game.blast.flare = 1;
      game.shake = Math.max(game.shake, 0.012 * w.strength);
      continue;
    }

    w.x += WAVE.speed * dt;

    if (!w.spent && w.x >= r.x) {
      w.spent = true;
      resolveWave(game, w);
    }
  }
}

/**
 * The one rule the game turns on.
 *
 * Cover is positional and nothing else: no button, no timing window. The object
 * is between the rabbit and the blast, or it is not.
 */
function resolveWave(game: Game, w: Wave): void {
  const r = game.rabbit;
  const cover: Prop | null = shelteredBy(r.x);
  game.shake = Math.max(game.shake, (cover ? 0.02 : 0.075) * w.strength);
  if (cover) {
    r.flinch = FLINCH_TIME;
    return;
  }
  // Strength varies the shove, not the blackout. Every wave that catches you
  // in the open puts you down for the same two and a half seconds — the
  // knockout is the punishment, and a weaker one is not a lesser lesson.
  r.stun = WAVE.stun * (0.85 + 0.15 * w.strength);
  r.vx = -WAVE.push * w.strength / Math.max(0.1, WAVE.stun * w.strength);
  r.lift = 0;
  r.vy = 0;
  r.airborne = false;
  r.skid = 0;
}

/** Seconds of running left between here and the burrow, at full tilt. */
export function runwayLeft(game: Game): number {
  return Math.abs(BURROW_AT - game.rabbit.x) / RUN_SPEED;
}

export const LEVEL_END = LEVEL_LEN;

export type InputSource = { read: () => Input; dispose: () => void };

const SWIPE_PX = 28;
const SWIPE_MS = 350;

/**
 * Keyboard and touch. The awkward case is touch: a hold and a swipe both begin
 * as a finger landing on one half of the screen, so every touch starts as a
 * run-hold and is *promoted* to a swipe if it travels far enough vertically
 * soon enough — at which point it stops steering. Touches are tracked per
 * identifier, so one thumb can hold a side while the other swipes.
 */
export function attachInput(target: HTMLElement): InputSource {
  const keys = new Set<string>();
  let jumpEdge = false;
  let diveEdge = false;
  let anyEdge = false;

  type Touching = { x0: number; y0: number; at: number; side: -1 | 1; steering: boolean };
  const touches = new Map<number, Touching>();

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(k)) {
      e.preventDefault();
    }
    if (!keys.has(k)) {
      if (k === " " || k === "arrowup" || k === "w") jumpEdge = true;
      if (k === "arrowdown" || k === "s") diveEdge = true;
      anyEdge = true;
    }
    keys.add(k);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.key.toLowerCase());
  };

  const onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      touches.set(t.identifier, {
        x0: t.clientX,
        y0: t.clientY,
        at: performance.now(),
        side: t.clientX - rect.left < rect.width / 2 ? -1 : 1,
        steering: true,
      });
      anyEdge = true;
    }
  };

  const onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const info = touches.get(t.identifier);
      if (!info || !info.steering) continue;
      const dy = t.clientY - info.y0;
      if (Math.abs(dy) < SWIPE_PX || performance.now() - info.at > SWIPE_MS) continue;
      info.steering = false;
      if (dy < 0) jumpEdge = true;
      else diveEdge = true;
    }
  };

  const onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) touches.delete(t.identifier);
  };

  target.addEventListener("keydown", onKeyDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  target.addEventListener("touchstart", onTouchStart, { passive: false });
  target.addEventListener("touchmove", onTouchMove, { passive: false });
  target.addEventListener("touchend", onTouchEnd);
  target.addEventListener("touchcancel", onTouchEnd);

  return {
    read: (): Input => {
      let left = keys.has("arrowleft") || keys.has("a");
      let right = keys.has("arrowright") || keys.has("d");
      for (const info of touches.values()) {
        if (!info.steering) continue;
        if (info.side < 0) left = true;
        else right = true;
      }
      const out: Input = { left, right, jumpEdge, diveEdge, anyEdge };
      jumpEdge = false;
      diveEdge = false;
      anyEdge = false;
      return out;
    },
    dispose: (): void => {
      target.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
    },
  };
}
