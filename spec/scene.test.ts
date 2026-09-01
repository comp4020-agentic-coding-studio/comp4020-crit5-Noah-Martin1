import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  INK,
  PALETTE,
  chroma,
  depthColor,
  luminance,
} from "../scene/palette.ts";
import type { Token } from "../scene/palette.ts";
import { CORN_FORE, CORN_WALL, DEPTH, GROUND_Y, RABBIT_HEIGHT } from "../scene/layout.ts";

// These are sensors, not contract tests for this week's brief. They hold a
// standard about how a picture is graded rather than about what this
// particular picture contains, so they are worth keeping pointed at whatever
// gets drawn next.
//
// Nothing here imports a module that touches canvas: the suite runs in node,
// not jsdom, so the pure half of the scene has to stay pure.

describe("palette: the whole budget goes on one red", () => {
  // Every neutral in the palette sits under 0.12 and both reds over 0.47, so
  // this threshold has a wide moat on both sides.
  const CHROMA = 0.25;

  it("gives chroma to the accent and to nothing else", () => {
    for (const [name, hex] of Object.entries(PALETTE) as [Token, string][]) {
      const c = chroma(hex);
      if (ACCENTS.includes(name)) {
        expect(c, `${name} is the accent — it has to carry colour`).toBeGreaterThan(CHROMA);
      } else {
        expect(
          c,
          `${name} (${hex}) has to read as neutral: one red is the whole point`,
        ).toBeLessThan(CHROMA);
      }
    }
  });

  it("keeps off pure black and pure white", () => {
    // A silhouette at #000 stops being a value in a range and becomes a hole.
    for (const [name, hex] of Object.entries(PALETTE) as [Token, string][]) {
      expect(luminance(hex), `${name} bottomed out`).toBeGreaterThan(0);
      expect(luminance(hex), `${name} blew out`).toBeLessThan(1);
    }
  });
});

describe("aerial perspective", () => {
  const depths = [...new Set(Object.values(DEPTH))].sort((a, b) => a - b);

  it("lightens every layer, without exception, as it recedes", () => {
    // The one relationship the whole look rests on. If a near layer ever comes
    // out lighter than a far one, depth inverts and the image falls flat.
    for (let i = 1; i < depths.length; i += 1) {
      const near = depthColor(depths[i - 1]);
      const far = depthColor(depths[i]);
      expect(
        luminance(far),
        `depth ${depths[i]} (${far}) must be lighter than ${depths[i - 1]} (${near})`,
      ).toBeGreaterThan(luminance(near));
    }
  });

  it("leaves the rabbit the darkest thing in the frame", () => {
    for (const depth of depths) {
      expect(luminance(depthColor(depth))).toBeGreaterThanOrEqual(luminance(INK));
    }
  });
});

describe("composition", () => {
  it("runs the animals on open ground, in front of the crop", () => {
    // Feet in front of the field, or the corn swallows whatever you steer.
    expect(GROUND_Y).toBeGreaterThan(CORN_WALL.base);
    expect(GROUND_Y).toBeLessThan(1);
  });

  it("keeps the foreground below the line the animals run on", () => {
    // A foreground that occludes the player is a bug however good it looks, so
    // the fringe has to start below the ground line and stay there.
    expect(CORN_FORE.top).toBeGreaterThan(GROUND_Y);
  });

  it("keeps the whole animal on screen", () => {
    expect(GROUND_Y - RABBIT_HEIGHT).toBeGreaterThan(0);
    expect(GROUND_Y).toBeLessThan(1);
  });
});
