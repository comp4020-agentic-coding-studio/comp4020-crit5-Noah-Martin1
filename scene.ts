// "The Long Field" — a rabbit, a cornfield, and forty-five seconds.
//
// At rest the game is a still tableau: the rabbit stands breathing in the corn
// and nothing else happens. The first movement starts a clock the player does
// not know exists, and five seconds later the sky opens up behind them.

import { frameOf } from "./scene/draw.ts";
import type { Frame } from "./scene/draw.ts";
import { depthColor, rgba } from "./scene/palette.ts";
import { makeRng, noise1d } from "./scene/rng.ts";
import {
  ASPECT,
  BURROW_AT,
  CAMERA_LEAD,
  CORN_BANDS,
  CORN_FORE,
  CORN_WALL,
  DEPTH,
  GROUND_Y,
  JUMP_V,
  LAMP_POS,
  PARALLAX,
  POOL,
  PROPS,
  RABBIT_HEIGHT,
  RABBIT_RIG_H,
  RUN_SPEED,
  RUN_TIME,
  WAVE,
} from "./scene/layout.ts";
import { drawFloodlight } from "./scene/layers.ts";
import {
  beamOf, drawBeam, drawBirds, drawFog, drawGrain, drawLampBloom, drawMotes,
  drawPool, drawVignette, flickerOf, makeGrain, seedFog, seedMotes,
} from "./scene/atmosphere.ts";
import type { FogBlob, Mote } from "./scene/atmosphere.ts";
import { buildWorld, drawBurrow, gustAndWrap, screenX, wrapBlit } from "./scene/world.ts";
import type { World } from "./scene/world.ts";
import { lampsNear, litness } from "./scene/rules.ts";
import {
  airPose, blendPose, boundPose, divePose, drawRabbitRig, drawRibbonBloom,
  flinchPose, idlePose, knockedPose, skidPose, standPose,
} from "./scene/rig.ts";
import type { Pose } from "./scene/rig.ts";
import { attachInput, makeGame, update, FLINCH_TIME, RABBIT_HALF } from "./scene/game.ts";
import type { Game } from "./scene/game.ts";
import { drawBlast, drawBlastLight, drawConsume, drawFlare, drawFlash } from "./scene/blast.ts";
import { drawGrit, drawWave, gustOf, spawnGrit } from "./scene/shockwave.ts";
import type { Grit } from "./scene/shockwave.ts";
import { drawProp } from "./scene/props.ts";
import { drawConcussion, drawLost, drawSurvived, drawTimer } from "./scene/hud.ts";
import { makeAudio } from "./scene/audio.ts";

const SEED = 20260901;

type Extras = {
  grain: ReturnType<typeof makeGrain>;
  motes: Mote[];
  fog: FogBlob[];
  grit: Grit[];
};

const windAt = (t: number): number =>
  Math.sin(t * 0.55) * 0.62 + Math.sin(t * 0.23 + 1.7) * 0.38;

/** Ear twitches: seeded, so the rabbit fidgets at the same moments every time
 *  rather than differently on each reload. */
function twitchAt(t: number, seed: number): number {
  const beat = Math.floor(t / 5.5);
  const at = beat * 5.5 + noise1d(beat, seed) * 4;
  const p = (t - at) / 0.24;
  return p > 0 && p < 1 ? -0.15 * Math.sin(Math.PI * p) ** 0.6 : 0;
}

function rabbitPose(game: Game, t: number): Pose {
  const r = game.rabbit;
  const speed = Math.min(1, Math.abs(r.vx) / RUN_SPEED);

  if (game.phase === "idle") {
    return idlePose(t, twitchAt(t, 7), twitchAt(t, 3));
  }
  if (game.phase === "escaped") return divePose(r.dive);
  if (r.stun > 0) return knockedPose(r.stun / WAVE.stun);
  if (r.flinch > 0) return flinchPose(r.flinch / FLINCH_TIME);

  const moving = r.airborne
    ? airPose(r.vy / JUMP_V, speed)
    : r.skid > 0
      ? skidPose(1 - r.skid, speed)
      : blendPose(standPose(t, speed), boundPose(r.gait, speed), Math.min(1, speed / 0.35));

  // Coming out of the idle, the body unfolds into the run over a third of a
  // second, so starting is one continuous motion rather than a cut.
  if (game.phaseT < 0.3) {
    return blendPose(idlePose(t, 0, 0), moving, game.phaseT / 0.3);
  }
  return moving;
}

/** A soft ellipse under the rabbit, painted in the ground's own tone so it
 *  subtracts light rather than adding dark — the trick the whole field uses. */
function actorShadow(ctx: CanvasRenderingContext2D, f: Frame, x: number, w: number, lift: number): void {
  const fade = Math.max(0, 1 - lift * 5.5);
  if (fade <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.65 * fade;
  ctx.fillStyle = depthColor(DEPTH.GROUND_NEAR);
  ctx.filter = `blur(${4 * f.u}px)`;
  ctx.beginPath();
  ctx.ellipse(x - w * 0.5, GROUND_Y * f.h + 2 * f.u, w * (0.9 + lift * 3), w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(
  ctx: CanvasRenderingContext2D, f: Frame, world: World, game: Game, extras: Extras,
  t: number, dt: number, frameIndex: number,
): void {
  const r = game.rabbit;
  const camX = r.x + CAMERA_LEAD * r.facing;
  const shift = (p: number): number => -camX * p * f.w;
  const wind = windAt(t);
  const flicker = flickerOf(t);
  // The floodlights die with the blast — the pulse takes them out — which is
  // what hands the frame over to the fire as its only light source.
  const lampLife = game.blast.t === null ? 1 : Math.max(0, 1 - game.blast.t / 0.4);

  const toScreen = (worldX: number): number => screenX(f, worldX, camX);
  /** Ambient sway plus whatever the shockwave is doing at that column. */
  const bendAt = (parallax: number, amp: number, phase: number) =>
    (sx: number): number => {
      const worldX = camX + (sx - f.w / 2) / (parallax * f.w);
      return amp * Math.sin(phase + sx * 0.0045) + gustOf(game.waves, worldX) * amp * 8;
    };

  ctx.save();
  if (game.shake > 0.0005) {
    const s = game.shake * f.h;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.6);
  }

  ctx.clearRect(-f.w, -f.h, f.w * 3, f.h * 3);
  ctx.drawImage(world.sky.canvas, 0, 0);

  // 2. The blast, behind the treeline, so the field silhouettes against it.
  drawBlast(ctx, f, game.blast, camX);

  wrapBlit(ctx, world.far.canvas, shift(PARALLAX.TREELINE));
  if (game.blast.t === null) drawBirds(ctx, f, t);
  wrapBlit(ctx, world.poles.canvas, shift(PARALLAX.POLES));
  ctx.drawImage(world.ground.canvas, 0, 0);
  wrapBlit(ctx, world.fence.canvas, shift(PARALLAX.FENCE));

  const lamps = lampLife <= 0 ? [] : lampsNear(camX)
    .map((worldX) => ({ worldX, sx: toScreen(worldX) }))
    .filter(({ sx }) => sx > -0.45 * f.w && sx < 1.45 * f.w);

  for (const lamp of lamps) drawFloodlight(ctx, f, lamp.sx);
  ctx.save();
  ctx.globalAlpha = lampLife;
  for (const lamp of lamps) {
    drawPool(ctx, f, flicker, lamp.sx + (POOL.x - LAMP_POS.x) * f.w);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = (0.34 + 0.34 * litness(camX)) * lampLife;
  wrapBlit(ctx, world.cornShadow.canvas, shift(PARALLAX.CORN_FRONT));
  ctx.restore();

  gustAndWrap(ctx, world, f, world.cornBack, world.crowns.back,
    CORN_BANDS[0].top, CORN_BANDS[1].base, shift(PARALLAX.CORN_BACK),
    bendAt(PARALLAX.CORN_BACK, 5 * f.u, t * 0.55));
  gustAndWrap(ctx, world, f, world.cornFront, world.crowns.front,
    CORN_WALL.top, CORN_WALL.base, shift(PARALLAX.CORN_FRONT),
    bendAt(PARALLAX.CORN_FRONT, 6 * f.u, t * 0.5 + 0.7));

  // 6. Jump obstacles, behind the rabbit: solid, and small enough to clear.
  for (const prop of PROPS) {
    if (prop.cover) continue;
    const sx = toScreen(prop.x);
    if (sx < -0.2 * f.w || sx > 1.2 * f.w) continue;
    drawProp(ctx, f, prop, sx);
  }

  drawBurrow(ctx, f, toScreen(BURROW_AT));

  const rabbitScale = (RABBIT_HEIGHT * f.h) / RABBIT_RIG_H;
  const rx = toScreen(r.x);
  const sink = game.phase === "escaped" ? r.dive : 0;
  actorShadow(ctx, f, rx, RABBIT_HEIGHT * f.h * 0.5, r.lift);
  const ribbon = { x: 0, y: 0 };
  ctx.save();
  if (sink > 0) {
    ctx.globalAlpha = 1 - sink * sink;
    ctx.translate(0, sink * 0.05 * f.h);
  }
  drawRabbitRig(ctx, f, {
    x: rx,
    y: GROUND_Y * f.h - r.lift * f.h,
    scale: rabbitScale,
    facing: Math.abs(r.turn) < 0.07 ? (r.turn < 0 ? -0.07 : 0.07) : r.turn,
  }, rabbitPose(game, t), wind, ribbon);
  ctx.restore();

  if (lampLife > 0) {
    ctx.save();
    ctx.globalAlpha = lampLife;
    for (const lamp of lamps) {
      if (Math.abs(lamp.sx - f.w / 2) > 1.15 * f.w) continue;
      const beam = beamOf(f, t, lamp.sx);
      drawBeam(ctx, f, beam, flicker, world.beamLayer);
      drawLampBloom(ctx, f, beam, flicker);
    }
    ctx.restore();
  }
  if (sink < 0.5 && ribbon.x > 0) drawRibbonBloom(ctx, f, ribbon);

  // 10. Cover, drawn *over* the rabbit. Sheltering is then literally what it
  //     looks like: the object stands between the rabbit and the blast.
  for (const prop of PROPS) {
    if (!prop.cover) continue;
    const sx = toScreen(prop.x);
    if (sx < -0.2 * f.w || sx > 1.2 * f.w) continue;
    // Cover stands taller than the rabbit, which is the point of it — but an
    // opaque one hides the player completely as they pass. Fading it where the
    // two overlap keeps the object in front and the rabbit findable.
    const behind = Math.abs(r.x - prop.x) < prop.half + RABBIT_HALF * 2;
    ctx.save();
    if (behind) ctx.globalAlpha = 0.5;
    drawProp(ctx, f, prop, sx);
    ctx.restore();
  }

  gustAndWrap(ctx, world, f, world.fore, world.crowns.fore,
    CORN_FORE.top, CORN_FORE.base, shift(PARALLAX.CORN_FORE),
    bendAt(PARALLAX.CORN_FORE, 17 * f.u, t * 0.41 + 2.6));

  drawWave(ctx, f, game.waves, toScreen);
  drawGrit(ctx, f, extras.grit, dt);

  drawFog(ctx, f, extras.fog, dt);
  const nearest = lamps.length > 0 ? lamps[0] : { sx: f.w / 2 };
  drawMotes(ctx, f, extras.motes, beamOf(f, t, nearest.sx), dt, t);

  drawBlastLight(ctx, f, game.blast, camX);
  drawGrain(ctx, f, extras.grain, frameIndex);
  drawVignette(ctx, f);
  if (r.stun > 0) drawConcussion(ctx, f, r.stun / WAVE.stun, t);
  drawFlash(ctx, f, game.blast);
  drawFlare(ctx, f, game.blast);

  if (game.blast.t !== null && game.phase !== "escaped" && game.phase !== "lost") {
    drawTimer(ctx, f, game.timeLeft, t);
  }

  ctx.restore();

  if (game.fade > 0) {
    ctx.fillStyle = rgba("#04070a", game.fade);
    ctx.fillRect(0, 0, f.w, f.h);
  }
  if (game.phase === "escaped") drawSurvived(ctx, f, game.timeLeft, game.phaseT / 1.1);
  if (game.phase === "lost") {
    // Only the clock running out is the blast arriving. A trap just ends it.
    if (game.death === "clock") drawConsume(ctx, f, game.phaseT / 2.4, camX);
    drawLost(ctx, f, (game.phaseT - (game.death === "clock" ? 1.9 : 1.0)) / 1.1, game.death);
  }
}

function main(): void {
  const canvas = document.getElementById("scene");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const stage = canvas.parentElement;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const game = makeGame(SEED);
  const input = attachInput(canvas);
  const audio = makeAudio();
  const wake = (): void => audio.start();
  for (const ev of ["pointerdown", "keydown", "touchstart", "pointermove"]) {
    window.addEventListener(ev, wake, { once: true, passive: true });
  }

  let f = frameOf(1, 1);
  let world: World | null = null;
  let extras: Extras | null = null;
  let resizeTimer = 0;
  let last = 0;
  let index = 0;
  let seenWaves = 0;

  const fit = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.clientWidth < 2) return;
    const width = Math.min(1920, Math.round(canvas.clientWidth * dpr));
    canvas.width = width;
    canvas.height = Math.round(width / ASPECT);
    f = frameOf(canvas.width, canvas.height);
    world = buildWorld(f, SEED);
    const rng = makeRng(SEED + 5);
    extras = {
      grain: makeGrain(rng), motes: seedMotes(rng, 150), fog: seedFog(rng, 14), grit: [],
    };
  };

  const paint = (t: number, dt: number): void => {
    if (!world || !extras) return;
    render(ctx, f, world, game, extras, t, dt, index);
    index += 1;
  };

  const frame = (ms: number): void => {
    const t = ms / 1000;
    const dt = Math.min(0.05, Math.max(0, t - last));
    last = t;

    const read = input.read();
    // Browsers will not start audio without a gesture, so the soundtrack comes
    // up on the same input that starts the game.
    if (read.anyEdge || read.left || read.right) audio.start();

    const hadBlast = game.blast.t !== null;
    const launched = game.waves.filter((w) => w.launched).length;
    const wasStunned = game.rabbit.stun > 0;
    const hadTime = game.timeLeft;
    const wasPhase = game.phase;

    update(game, read, dt);

    // Sound is driven off the same state transitions the picture is, so the two
    // can never drift apart.
    if (!hadBlast && game.blast.t !== null) audio.detonate();
    const nowLaunched = game.waves.filter((w) => w.launched);
    if (nowLaunched.length > launched) {
      const w = nowLaunched[nowLaunched.length - 1];
      audio.wave(w.strength, WAVE.warn);
    }
    if (!wasStunned && game.rabbit.stun > 0) {
      audio.thud();
      audio.concussion(game.rabbit.stun);
    }
    if (game.blast.t !== null) audio.tension(1 - game.timeLeft / RUN_TIME);

    // The last ten seconds get their own build, fired once as the clock
    // crosses; and the blackout lands on the frame the picture starts going.
    if (hadTime > 10 && game.timeLeft <= 10 && game.timeLeft > 0) audio.riser(10);
    if (wasPhase !== "lost" && game.phase === "lost") audio.blackout();

    // Debris is thrown when a wave launches, not every frame it exists.
    const live = game.waves.filter((w) => w.launched && !w.spent).length;
    if (extras && live > seenWaves) {
      for (const w of game.waves) {
        if (w.launched && !w.spent) spawnGrit(extras.grit, f, 0, w.strength);
      }
    }
    seenWaves = live;

    stage?.classList.toggle("playing", game.phase !== "idle");
    paint(t, dt * 60);
    if (!still.matches) requestAnimationFrame(frame);
  };

  fit();
  // Anyone who asked not to be moved gets the resting tableau, once.
  if (still.matches) paint(3.2, 1);
  else requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      fit();
      if (still.matches) paint(3.2, 1);
    }, 160);
  });
}

main();
