// The rules, kept free of canvas so they can be tested in node.
//
// Everything here is a pure function of world state. If a rule cannot be
// written as one, it belongs in game.ts.

import {
  BURROW_AT,
  BURROW_REACH,
  GROUND_Y,
  LEVEL_LEN,
  PROPS,
  RUN_SPEED,
  WAVE,
} from "./layout.ts";
import type { Prop } from "./layout.ts";

/** The field has ends now. Running at one is a wall, not a wrap. */
export function clampX(x: number): number {
  return Math.max(0, Math.min(LEVEL_LEN, x));
}

export type Body = { x: number; halfWidth: number };

export function overlaps(a: Body, b: Body): boolean {
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth;
}

/** Feet above a thing's top edge clear it. `feetY` is normalised, y down. */
export function clears(feetY: number, height: number): boolean {
  return feetY < GROUND_Y - height;
}

/**
 * The obstacle a rabbit at `x` is walking into, or null. Airborne rabbits whose
 * feet are above the obstacle pass over it freely, which is the only thing a
 * jump is for.
 */
export function blockedBy(x: number, halfWidth: number, feetY: number): Prop | null {
  for (const p of PROPS) {
    // Traps do not stop you. They are not in your way; they are underfoot.
    if (p.cover || p.kind === "trap") continue;
    if (!overlaps({ x, halfWidth }, { x: p.x, halfWidth: p.half })) continue;
    if (clears(feetY, p.height)) continue;
    return p;
  }
  return null;
}

/**
 * The cover a rabbit at `x` is sheltering behind, or null.
 *
 * The blast is always to the left, so shelter is the *lee* side: a little way
 * behind the object's near face and a good way past it. Standing on the blast
 * side of a drum is not cover, and it does not look like cover either.
 */
/**
 * The trap a rabbit at `x` has just put a foot in, or null.
 *
 * Barely off the ground, so any jump at all clears one — the difficulty is
 * entirely in seeing it, not in the timing. Nothing warns you; the field is
 * simply not safe, and you learn where they are by losing.
 */
export function trapAt(x: number, halfWidth: number, feetY: number): Prop | null {
  for (const p of PROPS) {
    if (p.kind !== "trap") continue;
    if (!overlaps({ x, halfWidth }, { x: p.x, halfWidth: p.half })) continue;
    if (clears(feetY, p.height)) continue;
    return p;
  }
  return null;
}

export function shelteredBy(x: number): Prop | null {
  for (const p of PROPS) {
    if (!p.cover) continue;
    if (x > p.x - p.half * 0.8 && x < p.x + p.shelter) return p;
  }
  return null;
}

export const COVERS: readonly Prop[] = PROPS.filter((p) => p.cover);

/**
 * The widest a player can ever be from the nearest cover, in frame-widths.
 * Compared against what they can run in WAVE.warn seconds, this is the
 * difference between a hard game and an unfair one.
 */
export function worstCoverGap(): number {
  let worst = 0;
  for (let i = 1; i < COVERS.length; i += 1) {
    worst = Math.max(worst, (COVERS[i].x - COVERS[i - 1].x) / 2);
  }
  return worst;
}

/** How far the rabbit can travel in the warning a wave gives. */
export const REACH_IN_WARNING = RUN_SPEED * WAVE.warn;

export function burrowInReach(rabbitX: number): boolean {
  return Math.abs(rabbitX - BURROW_AT) < BURROW_REACH;
}

/** Seconds of flat-out running between here and the burrow. */
export function secondsToBurrow(x: number): number {
  return Math.abs(BURROW_AT - x) / RUN_SPEED;
}

/**
 * Strength of the pressure front at a point, 0 to 1.
 *
 * The front is not a line: it has a body behind it and a long ramp in front,
 * and that ramp is what bends the corn before the wave itself arrives. The corn
 * reads this, so the whole field reacts to the same number.
 */
export function gustAt(worldX: number, frontX: number): number {
  const d = worldX - frontX;
  if (d > WAVE.lead) return 0;
  if (d > 0) return 1 - d / WAVE.lead;
  const behind = -d;
  if (behind > WAVE.band * 3) return 0;
  return Math.max(0, 1 - behind / (WAVE.band * 3));
}

export function lampsNear(worldX: number): number[] {
  const i = Math.round(worldX / 3.5);
  return [(i - 1) * 3.5, i * 3.5, (i + 1) * 3.5];
}

export function litness(worldX: number): number {
  const d = Math.abs(worldX - Math.round(worldX / 3.5) * 3.5);
  return Math.max(0, 1 - d / (3.5 * 0.62));
}
