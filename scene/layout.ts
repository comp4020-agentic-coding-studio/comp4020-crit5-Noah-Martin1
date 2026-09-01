// The composition, as data. Everything is normalised to the 16:9 frame —
// 0..1 across, 0..1 down — so the scene recomposes at any size instead of
// being pinned to a pixel grid.

export const ASPECT = 16 / 9;

/** Where earth meets sky. Kept low, so the sky has room to be empty. */
export const HORIZON = 0.615;

// Depth drives both colour (via depthColor) and blur. Keeping it in one table
// makes the ramp legible in one place, and lets the sensor walk it.
export const DEPTH = {
  SILOS: 0.88,
  TREELINE: 0.74,
  POLES: 0.6,
  FENCE: 0.5,
  FLOODLIGHT: 0.44,
  GROUND_FAR: 0.38,
  CORN_WALL: 0.3,
  RABBIT: 0.27,
  CORN_FLANK: 0.2,
  GROUND_NEAR: 0.18,
  CORN_FORE: 0.08,
} as const;

/** The lamp head: apex of the cone, and the brightest point in the frame. */
export const LAMP_POS = { x: 0.735, y: 0.145 };

// The beam's axis is derived in pixels from LAMP_POS to POOL rather than
// stored here: these coordinates are normalised against different extents (x
// by width, y by height), so an angle taken in this space would skew with the
// window.

/** Half-angle of the beam, radians, in pixel space. */
export const CONE_SPREAD = 0.22;

/** Where the beam lands on the track. The rabbit sits at this pool's edge. */
export const POOL = { x: 0.56, y: 0.792, rx: 0.30, ry: 0.09 };

// Left of the pool's centre by most of its radius: half-lit, at the edge of
// being found. A better picture than dead centre in the beam, which reads as
// already caught.
export const RABBIT_HEIGHT = 0.105;

// The wall of corn behind the open track. Its tops break the horizon, and it
// stops two thirds across so the field opens out on the right — otherwise it
// reads as one flat band and swallows the fence and the foot of the lamp post.
export const CORN_WALL = { base: 0.692, top: 0.472, x1: 0.63 };

// One band of stalks all rooted on the same line reads as a cutout wall. Three
// bands at different depths, each rooted a little further forward and drawn a
// little darker, give the field thickness and break the hard horizontal that
// the single band left across the frame.
export const CORN_BANDS = [
  { base: 0.638, top: 0.503, depth: 0.42, count: 420, scale: 0.8 },
  { base: 0.663, top: 0.482, depth: 0.3, count: 380, scale: 1 },
  { base: 0.692, top: 0.472, depth: 0.25, count: 250, scale: 1.3 },
];

// The out-of-focus fringe you peer over. It sits below the line the animals
// run on, so it frames the shot without ever hiding the thing you are steering
// — in a side-scroller a foreground that occludes the player is a bug, however
// good it looks.
export const CORN_FORE = { base: 1.2, top: 0.955 };

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

// World x is measured in frame-widths along a bounded track. The field no
// longer loops: there is a start, a burrow at the far end, and a blast behind
// you the whole way. The corn still tiles forever — the parallax layers repeat
// a one-frame tile and never knew about the loop — so only the rabbit is
// bounded.
export const LEVEL_LEN = 11.5;
export const START_X = 0.5;
// Raised with the wave count. Five waves cost roughly twelve seconds of
// sheltering, and at 0.32 the field alone took 34.7s of a 45s clock — the
// fairness test in spec/game.test.ts fails outright at that pairing.
export const RUN_SPEED = 0.38;
export const BURROW_AT = 11.1;

/** Where the rabbit's feet meet the ground. */
export const GROUND_Y = 0.858;

/** Lamp posts repeat through the world at this spacing. */
export const LAMP_SPACING = 3.5;

// The camera sits on the rabbit but leads slightly in the direction of travel,
// so the animal is framed a little behind where it is going.
export const CAMERA_LEAD = 0.08;

export const PARALLAX = {
  SILOS: 0.06,
  TREELINE: 0.12,
  POLES: 0.22,
  FENCE: 0.35,
  CORN_BACK: 0.55,
  CORN_MID: 0.68,
  CORN_FRONT: 0.82,
  CORN_FLANK: 0.9,
  ACTORS: 1,
  CORN_FORE: 1.35,
} as const;

// Apex is v^2/2g = 0.213 frame-heights, against a fence 0.055 tall. Generous:
// the difficulty is meant to live in the clock and the shockwaves, not here.
export const JUMP_V = 0.9;
export const GRAVITY = 1.9;

export const RABBIT_RIG_H = 126;

// ---------------------------------------------------------------------------
// The blast
// ---------------------------------------------------------------------------

/** Seconds between the player first moving and the detonation. */
export const BLAST_DELAY = 5;

/** Seconds on the clock once the sky lights up. */
export const RUN_TIME = 45;

// Far behind the start, and almost fixed: at this parallax it barely slides as
// you run, which is what makes it read as tens of kilometres away.
export const BLAST_X = -4;
export const BLAST_PARALLAX = 0.04;

// ---------------------------------------------------------------------------
// Shockwaves
// ---------------------------------------------------------------------------

/** Seconds into the countdown at which each wave arrives. */
export const WAVE_AT = [7, 14, 21, 28, 35];

// The first wave is a teacher: weak enough to survive in the open, and the one
// you learn the rule from.
export const WAVE_STRENGTH = [0.6, 1, 1, 1, 1];

export const WAVE = {
  /** Flare-to-impact. This is the player's entire reaction time, so the cover
   *  spacing below is derived from it and asserted in the tests. */
  warn: 3.2,
  /** Frame-widths a second. Faster than the rabbit, so it always catches up. */
  speed: 0.9,
  /** Half-width of the visible pressure front, in frame-widths. */
  band: 0.11,
  /** How far ahead of the front the corn starts to feel the pressure. */
  lead: 0.32,
  /** Seconds face-down after being caught in the open. Long enough to hurt:
   *  the clock does not stop, so this is the real cost of being exposed. */
  stun: 2.6,
  /** Frame-widths the blast throws you back. */
  push: 0.65,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PropKind =
  | "log" | "rock" | "fence"
  | "drum" | "tank" | "boulder"
  | "trap";

export type Prop = {
  kind: PropKind;
  /** World x, in frame-widths. */
  x: number;
  /** Half-width for collision and for drawing, in frame-widths. */
  half: number;
  /** Height above GROUND_Y, in frame-heights. */
  height: number;
  /** True for the big objects a shockwave breaks against. */
  cover: boolean;
  /** Lee distance a cover object shelters, in frame-widths. */
  shelter: number;
};

// Two kinds of object, and the difference is the whole game.
//
// Jump obstacles are small, solid, and drawn *behind* the rabbit: run into one
// at ground height and you are stopped until you jump it.
//
// Cover is large and drawn *in front of* the rabbit, so sheltering is literally
// what it looks like — the rabbit passes behind the object and the object is
// between it and the blast. Cover needs no collision at all, which is what
// keeps this mechanic to one line of rule.
//
// The spacing is load-bearing: no two neighbouring cover objects may sit
// further apart than the rabbit can run in WAVE.warn seconds, or a wave becomes
// undodgeable through no fault of the player. spec/game.test.ts asserts it.
export const PROPS: readonly Prop[] = [
  { kind: "log", x: 1.2, half: 0.070, height: 0.070, cover: false, shelter: 0 },
  { kind: "drum", x: 1.9, half: 0.042, height: 0.190, cover: true, shelter: 0.24 },
  { kind: "rock", x: 2.6, half: 0.055, height: 0.090, cover: false, shelter: 0 },
  { kind: "trap", x: 2.95, half: 0.022, height: 0.013, cover: false, shelter: 0 },
  { kind: "boulder", x: 3.4, half: 0.092, height: 0.165, cover: true, shelter: 0.26 },
  { kind: "fence", x: 4.2, half: 0.070, height: 0.120, cover: false, shelter: 0 },
  { kind: "tank", x: 4.9, half: 0.110, height: 0.430, cover: true, shelter: 0.28 },
  { kind: "trap", x: 5.45, half: 0.022, height: 0.013, cover: false, shelter: 0 },
  { kind: "log", x: 5.7, half: 0.070, height: 0.070, cover: false, shelter: 0 },
  { kind: "drum", x: 6.4, half: 0.042, height: 0.190, cover: true, shelter: 0.24 },
  { kind: "rock", x: 7.1, half: 0.055, height: 0.090, cover: false, shelter: 0 },
  { kind: "boulder", x: 7.8, half: 0.092, height: 0.165, cover: true, shelter: 0.26 },
  { kind: "trap", x: 8.25, half: 0.022, height: 0.013, cover: false, shelter: 0 },
  { kind: "fence", x: 8.5, half: 0.070, height: 0.120, cover: false, shelter: 0 },
  { kind: "tank", x: 9.2, half: 0.110, height: 0.430, cover: true, shelter: 0.28 },
  { kind: "log", x: 9.8, half: 0.070, height: 0.070, cover: false, shelter: 0 },
  { kind: "trap", x: 9.65, half: 0.022, height: 0.013, cover: false, shelter: 0 },
  { kind: "drum", x: 10.5, half: 0.042, height: 0.190, cover: true, shelter: 0.24 },
];

/** How near the burrow the rabbit must be for it to take. */
export const BURROW_REACH = 0.075;
export const BURROW_W = 0.062;
