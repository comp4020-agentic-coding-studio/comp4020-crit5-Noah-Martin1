// The scene is graded from two anchors: INK, the near-black every silhouette
// starts at, and FOG, the horizon haze every silhouette dissolves into. Layer
// greys are never picked by hand — depthColor() interpolates between the
// anchors, so changing a layer's depth cannot put it out of tune with the rest
// of the ramp.

export type Rgb = { r: number; g: number; b: number };

export const INK = "#070a0c";
export const FOG = "#9ba6ac";

export const SKY_TOP = "#232b31";
export const SKY_MID = "#414e57";
export const SKY_LOW = "#7e8a91";

export const LIGHT = "#e6e0d0";
export const LAMP = "#fff6e2";

export const RIBBON = "#9e2b24";
export const RIBBON_LIT = "#c4392c";

// The blast is the one thing allowed to break the monochrome, and it earns it
// by being the only light source left once the pulse kills the floodlights.
export const FIRE = "#e8944a";
export const FIRE_DEEP = "#b4442a";

/** What is left when the blast has taken the whole picture. */
export const ASH = "#d8d6d0";

// Every colour the scene may use. The palette sensor in spec/scene.test.ts
// walks this table, so a colour added here without thought fails the check.
export const PALETTE = {
  INK,
  FOG,
  SKY_TOP,
  SKY_MID,
  SKY_LOW,
  LIGHT,
  LAMP,
  RIBBON,
  RIBBON_LIT,
  FIRE,
  FIRE_DEEP,
  ASH,
} as const;

export type Token = keyof typeof PALETTE;

// INSIDE spends its entire colour budget on one red, and this piece spends it
// on a red ribbon and a fire. These are the only tokens allowed to carry
// chroma; every other token has to read as neutral. The rule is not that there
// is one accent — it is that every accent is deliberate and named here.
export const ACCENTS: readonly Token[] = ["RIBBON", "RIBBON_LIT", "FIRE", "FIRE_DEEP"];

export function toRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
}

export function mix(from: string, to: string, t: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  const k = Math.max(0, Math.min(1, t));
  const r = channel(a.r + (b.r - a.r) * k);
  const g = channel(a.g + (b.g - a.g) * k);
  const bl = channel(a.b + (b.b - a.b) * k);
  return `#${r}${g}${bl}`;
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Haze does not build linearly with distance. Near layers stay crushed dark
// far longer than a straight lerp suggests, then everything rushes toward the
// fog colour across the last third. This exponent is that curve, and it is the
// single thing most responsible for the look.
export function depthColor(depth: number): string {
  return mix(INK, FOG, Math.max(0, Math.min(1, depth)) ** 1.35);
}

/** Relative luminance, 0..1. Read by the aerial-perspective sensor. */
export function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Absolute chroma, 0..1 — the plain spread between the strongest and weakest
 * channel. Read by the palette sensor.
 *
 * Deliberately not HSL saturation, which divides by lightness and so reports
 * near-black neutrals as heavily saturated: INK is five values of blue away
 * from grey and HSL calls that 0.27, right next to a real red. Absolute chroma
 * puts every neutral in this palette under 0.12 and both reds over 0.47, which
 * is a threshold that means something.
 */
export function chroma(hex: string): number {
  const { r, g, b } = toRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}
