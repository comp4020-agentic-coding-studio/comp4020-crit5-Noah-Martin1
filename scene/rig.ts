// Both animals, as jointed rigs rather than frozen outlines.
//
// Everything is built in a local space whose origin is the HIP, +x forward
// (the way the nose points) and +y down. That one choice does most of the work:
// a rabbit sitting up is the same body rotated about the hip, so sit and run
// are two ends of one parameter instead of two unrelated drawings, and the
// transition between them is free.
//
// Limbs are drawn as tapered two-segment strokes rather than as paths. In flat
// silhouette a stroke reads exactly like a filled leg, and a stroke can be
// posed with two numbers.

import type { Ctx, Frame } from "./draw.ts";
import { INK, RIBBON, RIBBON_LIT, rgba } from "./palette.ts";

export type Joint = { a1: number; a2: number };

export type Pose = {
  /** Torso rotation about the hip. 0 runs level; negative sits it up. */
  bodyAngle: number;
  /** Hip height above the standing line, in rig units. Negative is airborne. */
  hipLift: number;
  bodyStretch: number;
  headAngle: number;
  /** 0 = ears up and alert, 1 = flat back along the spine. */
  earSweep: number;
  earFarSplay: number;
  earNearSplay: number;
  hindFar: Joint;
  hindNear: Joint;
  frontFar: Joint;
  frontNear: Joint;
  tailAngle: number;
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A two-segment limb as tapering strokes, plus a foot. Same fill as the body,
 *  so the overlaps at the joints simply vanish. */
function limb(
  ctx: Ctx, ox: number, oy: number, joint: Joint,
  upper: number, lower: number, w1: number, w2: number, foot: number,
): void {
  const kx = ox + Math.cos(joint.a1) * upper;
  const ky = oy + Math.sin(joint.a1) * upper;
  const fx = kx + Math.cos(joint.a2) * lower;
  const fy = ky + Math.sin(joint.a2) * lower;

  ctx.lineCap = "round";
  ctx.lineWidth = w1;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(kx, ky);
  ctx.stroke();

  ctx.lineWidth = w2;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  if (foot > 0) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, foot, foot * 0.5, joint.a2 - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function path(build: (p: Path2D) => void): Path2D {
  const p = new Path2D();
  build(p);
  p.closePath();
  return p;
}

// A rabbit is mostly haunch. The rear of this outline is more than twice the
// depth of the chest, which is the proportion that reads as "can bolt".
const RABBIT_TORSO = path((p) => {
  p.moveTo(57, -31);
  p.bezierCurveTo(63, -21, 61, -5, 53, 4);   // neck, then the chest below it
  p.bezierCurveTo(43, 12, 30, 15, 18, 15);
  p.bezierCurveTo(6, 16, -6, 13, -13, 4);
  p.bezierCurveTo(-20, -5, -20, -19, -12, -26);
  p.bezierCurveTo(-2, -32, 14, -30, 28, -28);
  p.bezierCurveTo(40, -27, 51, -32, 57, -31);
});

const RABBIT_HEAD = path((p) => {
  p.moveTo(0, 3);
  p.bezierCurveTo(3, -10, 15, -16, 25, -13);
  p.bezierCurveTo(34, -10, 41, -3, 40, 4);
  p.bezierCurveTo(39, 11, 28, 15, 16, 14);
  p.bezierCurveTo(7, 13, 1, 10, 0, 3);
});

/** One ear, base at the origin, pointing up. Rotated for sweep and splay. */
const EAR = path((p) => {
  p.moveTo(-3, 2);
  p.quadraticCurveTo(-6, -20, -2.5, -45);
  p.quadraticCurveTo(1, -49, 5.5, -44);
  p.quadraticCurveTo(7.5, -20, 5, 2);
});

const RABBIT_TAIL = path((p) => {
  p.ellipse(-17, -6, 8, 7, -0.3, 0, Math.PI * 2);
});

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export type Placement = {
  /** Screen position of the standing line under the hip, in pixels. */
  x: number;
  y: number;
  scale: number;
  /** 1 faces right, -1 faces left. */
  facing: number;
};

const RABBIT_HIP_UP = 50;

export function drawRabbitRig(
  ctx: Ctx, f: Frame, at: Placement, pose: Pose, wind: number, ribbon?: { x: number; y: number },
): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(at.facing * at.scale, at.scale);
  ctx.translate(0, -RABBIT_HIP_UP + pose.hipLift);

  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;

  // Far limbs first, then the torso over them, then near limbs on top: the
  // torso hides the far shoulder and hip, which is what gives a flat
  // silhouette its sense of two sides.
  // The shoulder rides the body rotation. Left at a fixed point it tore away
  // from the chest the moment the rabbit sat up.
  const ca = Math.cos(pose.bodyAngle);
  const sa = Math.sin(pose.bodyAngle);
  const shx = 44 * pose.bodyStretch * ca + 2 * sa;
  const shy = 44 * pose.bodyStretch * sa - 2 * ca;

  limb(ctx, 0, 0, pose.hindFar, 27, 25, 9, 5.5, 5);
  limb(ctx, shx, shy, pose.frontFar, 27, 25, 7, 4.5, 4);

  ctx.save();
  ctx.rotate(pose.bodyAngle);
  ctx.scale(pose.bodyStretch, 1);
  ctx.fill(RABBIT_TAIL);
  ctx.fill(RABBIT_TORSO);

  ctx.save();
  ctx.translate(55, -28);
  ctx.rotate(pose.headAngle);

  // Ears sweep back along the spine as speed builds. They are most of what the
  // eye reads at this size, so they are the first thing the motion touches.
  for (const [splay, near] of [[pose.earFarSplay, false], [pose.earNearSplay, true]] as const) {
    ctx.save();
    ctx.translate(near ? 19 : 3, near ? -6 : -11);
    // Negative sweeps the tips backward along the spine. Positive rotated
    // them forward and past the nose, which folded the whole animal flat.
    ctx.rotate(splay - pose.earSweep * 0.95);
    ctx.fill(EAR);
    if (near && ribbon) drawRibbon(ctx, wind, ribbon);
    ctx.restore();
  }

  ctx.fill(RABBIT_HEAD);
  ctx.restore();
  ctx.restore();

  limb(ctx, 0, 0, pose.hindNear, 28, 26, 10, 6, 5.5);
  limb(ctx, shx, shy, pose.frontNear, 28, 26, 7.5, 5, 4.5);
  ctx.restore();
}

/** The frayed band, high on the near ear — the only chroma in the frame. */
function drawRibbon(ctx: Ctx, wind: number, out: { x: number; y: number }): void {
  const lit = ctx.createLinearGradient(-10, 0, 12, 0);
  lit.addColorStop(0, RIBBON);
  lit.addColorStop(1, RIBBON_LIT);
  ctx.fillStyle = lit;

  ctx.beginPath();
  ctx.moveTo(-7.6, -25.5);
  ctx.lineTo(8.4, -27.6);
  ctx.lineTo(8.8, -23.4);
  ctx.lineTo(-7.2, -21.3);
  ctx.closePath();
  ctx.fill();

  for (const tail of [
    { at: -23, len: 11, drop: 9, k: 4.2 },
    { at: -21, len: 8, drop: 11, k: 5.6 },
  ]) {
    const tx = -7 - tail.len + wind * tail.k;
    const ty = tail.at + tail.drop + wind * 2.2;
    ctx.beginPath();
    ctx.moveTo(-7, tail.at - 1.5);
    ctx.quadraticCurveTo(-7 - tail.len * 0.55, tail.at + tail.drop * 0.3, tx, ty);
    ctx.quadraticCurveTo(-7 - tail.len * 0.38, tail.at + tail.drop * 0.4, -6.4, tail.at + 2.2);
    ctx.closePath();
    ctx.fill();
  }

  const here = ctx.getTransform().transformPoint({ x: 0, y: -24 });
  out.x = here.x;
  out.y = here.y;
  ctx.fillStyle = INK;
}

/** A whisper of glow, so the one red survives the haze laid over it. */
export function drawRibbonBloom(ctx: Ctx, f: Frame, at: { x: number; y: number }): void {
  const r = 0.0085 * f.w;
  const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
  glow.addColorStop(0, rgba(RIBBON_LIT, 0.28));
  glow.addColorStop(1, rgba(RIBBON_LIT, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Poses
//
// Every pose is a continuous function of one or two parameters rather than a
// set of keyframes, so blending between them is free and nothing ever pops.
// Angles are in local space, where +x is forward and +y is down — so pi/2
// points at the ground.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function leg(a1: number, a2: number): Joint {
  return { a1, a2 };
}

/** The still tableau: up on the haunches, ears alert. Same body as the run,
 *  rotated about the hip — which is exactly how a real rabbit sits. */
export function sitPose(t: number, twitchFar: number, twitchNear: number): Pose {
  const breath = Math.sin(t * 1.8) * 0.015;
  return {
    bodyAngle: -0.9,
    hipLift: 34,
    bodyStretch: 1 + breath,
    headAngle: 0.55,
    earSweep: 0,
    earFarSplay: -0.34 + twitchFar,
    earNearSplay: 0.08 + twitchNear,
    hindFar: leg(0.5, 0.12),
    hindNear: leg(0.55, 0.15),
    frontFar: leg(1.42, 1.66),
    frontNear: leg(1.45, 1.62),
    tailAngle: 0,
  };
}

/**
 * The bound. Rabbits do not trot — they drive with both hind legs together,
 * extend full-length, land on the front pair, then swing the hind legs forward
 * *outside* the front ones and coil again. One big vertical per cycle with an
 * asymmetric ease. Getting this gait right is most of what makes the animal
 * read as a rabbit at forty pixels tall.
 */
// Straight down and fully extended: the angles a leg holds at the instant it
// takes weight. Everything else in the gait is measured against these, so the
// feet actually meet the ground instead of pedalling above it.
const HIND_PLANT = { a1: 1.35, a2: 1.62 };
const HIND_TUCK = { a1: 0.75, a2: 2.9 };
const FRONT_PLANT = { a1: 1.6, a2: 1.52 };
const FRONT_TUCK = { a1: 1.25, a2: 2.5 };

/** 1 at the moment this pair takes weight, 0 half a cycle later. */
function extension(u: number, plantAt: number): number {
  return 0.5 + 0.5 * Math.cos((u - plantAt) * TAU);
}

function swing(u: number, plantAt: number, plant: Joint, tuck: Joint): Joint {
  const e = extension(u, plantAt);
  return leg(mix(tuck.a1, plant.a1, e), mix(tuck.a2, plant.a2, e));
}

export function boundPose(u: number, speed: number): Pose {
  const w = u * TAU;
  // Asymmetric arc: down at the hind plant, up through the long float, down
  // again as the front pair reaches. A symmetric sine reads as a bounce.
  const s = (u + 0.2) % 1;
  const hop = s < 0.62 ? Math.sin((Math.PI * s) / 0.62) : 0;
  const lag = 0.07; // the far pair trails the near one, so it reads as two sides

  return {
    bodyAngle: -0.26 * Math.sin(w + 0.4),
    hipLift: -16 * hop ** 0.9,
    bodyStretch: 1 + 0.09 * hop,
    headAngle: 0.1 + 0.12 * Math.sin(w + 0.6),
    earSweep: speed,
    earFarSplay: -0.42 - 0.1 * Math.sin(w + 1.4),
    earNearSplay: 0.06 + 0.12 * Math.sin(w + 1.1),
    hindNear: swing(u, 0.72, HIND_PLANT, HIND_TUCK),
    hindFar: swing(u - lag, 0.72, HIND_PLANT, HIND_TUCK),
    frontNear: swing(u, 0.5, FRONT_PLANT, FRONT_TUCK),
    frontFar: swing(u - lag, 0.5, FRONT_PLANT, FRONT_TUCK),
    tailAngle: 0,
  };
}

/** Airborne. Legs stream out at launch, tuck at the apex, and reach for the
 *  ground on the way down; the body pitches to follow the velocity vector. */
export function airPose(rise: number, speed: number): Pose {
  const r = clamp(rise, -1, 1);
  const up = Math.max(0, r);
  const down = Math.max(0, -r);

  return {
    bodyAngle: -0.34 * r,
    hipLift: 0,
    bodyStretch: 1 + 0.12 * Math.abs(r),
    headAngle: 0.14 - 0.2 * r,
    earSweep: speed,
    earFarSplay: -0.24 - 0.2 * up,
    earNearSplay: 0.05 - 0.18 * up,
    hindNear: leg(mix(1.15, 2.3, up) - 0.25 * down, mix(2.6, 2.05, up) - 0.3 * down),
    hindFar: leg(mix(1.12, 2.24, up) - 0.25 * down, mix(2.56, 2.0, up) - 0.3 * down),
    frontNear: leg(mix(1.2, 0.95, up) + 0.35 * down, mix(2.2, 1.85, up) - 0.55 * down),
    frontFar: leg(mix(1.24, 0.99, up) + 0.35 * down, mix(2.24, 1.9, up) - 0.55 * down),
    tailAngle: 0,
  };
}

/** The skid. Weight goes back, the front legs brace, the body squashes as the
 *  facing flips at the midpoint, then it drives out the other way. */
export function skidPose(p: number, speed: number): Pose {
  const s = Math.sin(Math.PI * clamp(p, 0, 1));
  return {
    bodyAngle: -0.5 * s,
    hipLift: 7 * s,
    bodyStretch: 1 - 0.17 * s,
    headAngle: 0.2 + 0.35 * s,
    earSweep: speed * (1 - 0.65 * s),
    earFarSplay: -0.25 - 0.55 * s,
    earNearSplay: 0.05 - 0.45 * s,
    hindNear: leg(1.25 - 0.35 * s, 2.5 + 0.3 * s),
    hindFar: leg(1.3 - 0.35 * s, 2.55 + 0.3 * s),
    frontNear: leg(1.5 + 0.5 * s, 1.5 + 0.15 * s),
    frontFar: leg(1.54 + 0.5 * s, 1.54 + 0.15 * s),
    tailAngle: 0,
  };
}

/** Into the hole: the whole animal stretches into a line and goes nose-first. */
export function divePose(p: number): Pose {
  const q = clamp(p, 0, 1);
  return {
    bodyAngle: 0.35 + 0.55 * q,
    hipLift: -6 * Math.sin(Math.PI * q),
    bodyStretch: 1 + 0.4 * q,
    headAngle: -0.2 * q,
    earSweep: 1,
    earFarSplay: -0.1,
    earNearSplay: 0.05,
    hindNear: leg(2.4 + 0.3 * q, 2.2 + 0.3 * q),
    hindFar: leg(2.36 + 0.3 * q, 2.16 + 0.3 * q),
    frontNear: leg(0.75 - 0.3 * q, 0.6 - 0.3 * q),
    frontFar: leg(0.79 - 0.3 * q, 0.64 - 0.3 * q),
    tailAngle: 0,
  };
}

/** The dog's gallop: longer, flatter and more level than the rabbit's bound,
 *  with the head carried low. Less vertical is more predatory. */



/** Blend two poses. Used for sit-to-run and for easing out of a skid. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const k = clamp(t, 0, 1);
  const j = (x: Joint, y: Joint): Joint => leg(mix(x.a1, y.a1, k), mix(x.a2, y.a2, k));
  return {
    bodyAngle: mix(a.bodyAngle, b.bodyAngle, k),
    hipLift: mix(a.hipLift, b.hipLift, k),
    bodyStretch: mix(a.bodyStretch, b.bodyStretch, k),
    headAngle: mix(a.headAngle, b.headAngle, k),
    earSweep: mix(a.earSweep, b.earSweep, k),
    earFarSplay: mix(a.earFarSplay, b.earFarSplay, k),
    earNearSplay: mix(a.earNearSplay, b.earNearSplay, k),
    hindFar: j(a.hindFar, b.hindFar),
    hindNear: j(a.hindNear, b.hindNear),
    frontFar: j(a.frontFar, b.frontFar),
    frontNear: j(a.frontNear, b.frontNear),
    tailAngle: mix(a.tailAngle, b.tailAngle, k),
  };
}

/** Standing still, mid-run. Without this the gait freezes on whatever frame it
 *  stopped at, which reads as a photograph rather than as an animal at rest. */
/**
 * At rest, standing. The opening tableau.
 *
 * The whole game waits in this pose, so it has to survive being looked at: a
 * slow breath through the body, the head drifting on a slower cycle than the
 * breath so the two never lock into a loop, and ears that twitch on their own
 * seeded schedule. Nothing here announces that the rabbit can be moved — it
 * just looks alive enough to poke at.
 */
export function idlePose(t: number, twitchFar: number, twitchNear: number): Pose {
  const breath = Math.sin(t * 1.55) * 0.017;
  const settle = Math.sin(t * 0.63 + 1.1) * 0.03;
  return {
    bodyAngle: -0.12 + settle * 0.35,
    hipLift: 3 + breath * 40,
    bodyStretch: 1 + breath,
    headAngle: 0.30 + settle,
    earSweep: 0,
    earFarSplay: -0.30 + twitchFar,
    earNearSplay: 0.10 + twitchNear,
    hindFar: leg(1.36, 1.62),
    hindNear: leg(1.31, 1.66),
    frontFar: leg(1.66, 1.48),
    frontNear: leg(1.60, 1.53),
    tailAngle: 0,
  };
}

/**
 * Pressed down behind cover as the wave goes over. `p` runs 1 to 0.
 *
 * This is the mechanic's only teacher. Nothing says "you are safe" — the rabbit
 * just flattens itself the way an animal does, and survives, and the player
 * infers the rule from having watched it work.
 */
export function flinchPose(p: number): Pose {
  const q = clamp(p, 0, 1);
  return {
    bodyAngle: -0.02 + 0.1 * q,
    hipLift: 16 * q,
    bodyStretch: 1 - 0.05 * q,
    headAngle: 0.52 * q + 0.3,
    earSweep: 1.15 * q,
    earFarSplay: -0.1 * (1 - q),
    earNearSplay: 0.04 * (1 - q),
    hindFar: leg(1.15 + 0.2 * q, 2.0 + 0.5 * q),
    hindNear: leg(1.12 + 0.2 * q, 2.05 + 0.5 * q),
    frontFar: leg(1.75 - 0.25 * q, 1.35 + 0.5 * q),
    frontNear: leg(1.7 - 0.25 * q, 1.4 + 0.5 * q),
    tailAngle: 0,
  };
}

/**
 * Blown over. `p` runs 1 (just hit) to 0 (back on its feet).
 *
 * Rolled onto its side with the legs thrown forward, because the blast came
 * from behind. It rights itself as p decays, so the recovery is the same
 * function played out rather than a separate animation.
 */
export function knockedPose(p: number): Pose {
  const q = clamp(p, 0, 1);
  // Flat for most of it, righting itself only in the last quarter — the lying
  // there is the punishment, so it has to read as lying there.
  const roll = q > 0.28 ? 1 : q / 0.28;
  /** down = fully out, up = back on its feet. */
  const m = (down: number, up: number): number => up + (down - up) * roll;

  // Rotating the body hard tipped it nose-first and read as a dive. What reads
  // as unconscious is the hip on the ground, the legs thrown straight out front
  // and back, and the head down — not the spine at an angle.
  return {
    bodyAngle: m(-0.30, -0.08),
    hipLift: m(40, 4),
    bodyStretch: m(1.12, 1),
    headAngle: m(1.05, 0.32),
    earSweep: m(1.4, 0),
    earFarSplay: m(-0.55, -0.28),
    earNearSplay: m(0.45, 0.06),
    hindFar: leg(m(2.95, 1.38), m(3.08, 1.6)),
    hindNear: leg(m(2.86, 1.33), m(3.0, 1.64)),
    frontFar: leg(m(0.18, 1.63), m(0.06, 1.5)),
    frontNear: leg(m(0.1, 1.58), m(-0.02, 1.54)),
    tailAngle: 0,
  };
}

export function standPose(t: number, speed: number): Pose {
  const breath = Math.sin(t * 1.9) * 0.012;
  return {
    bodyAngle: -0.08,
    hipLift: 2,
    bodyStretch: 1 + breath,
    headAngle: 0.34,
    earSweep: speed * 0.2,
    earFarSplay: -0.28,
    earNearSplay: 0.06,
    hindFar: leg(1.38, 1.6),
    hindNear: leg(1.33, 1.64),
    frontFar: leg(1.63, 1.5),
    frontNear: leg(1.58, 1.54),
    tailAngle: 0,
  };
}
