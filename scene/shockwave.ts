// The pressure front: what you are actually running from.
//
// The wave is one number — the world x of its front — and everything else reads
// from it. The corn asks `gustAt` how hard to bend, the dust asks how hard it is
// being pushed, and the rule asks whether it has reached the rabbit yet. One
// source of truth means the thing you see and the thing that hits you can never
// disagree.

import type { Ctx, Frame } from "./draw.ts";
import { LIGHT, rgba } from "./palette.ts";
import { CORN_FORE, GROUND_Y, HORIZON, WAVE } from "./layout.ts";
import { gustAt } from "./rules.ts";

export type Wave = {
  /** Seconds into the countdown at which it reaches the rabbit. */
  at: number;
  strength: number;
  launched: boolean;
  /** Resolved against the rabbit — a wave only ever hits once. */
  spent: boolean;
  /** World x of the front. */
  x: number;
};

export function makeWaves(times: readonly number[], strengths: readonly number[]): Wave[] {
  return times.map((at, i) => ({
    at,
    strength: strengths[i] ?? 1,
    launched: false,
    spent: false,
    x: 0,
  }));
}

/**
 * Where a wave has to start so that it arrives on time.
 *
 * It launches WAVE.warn seconds before impact and closes on a rabbit that is
 * itself running away, so the distance is the *relative* speed times the
 * warning. Deriving it rather than picking it means the warning the player gets
 * is exactly the warning the schedule promises.
 */
export function launchX(rabbitX: number, rabbitSpeed: number): number {
  return rabbitX - (WAVE.speed - rabbitSpeed) * WAVE.warn;
}

/** The strongest gust at a point from any live wave, 0..1. */
export function gustOf(waves: readonly Wave[], worldX: number): number {
  let g = 0;
  for (const w of waves) {
    if (!w.launched) continue;
    g = Math.max(g, gustAt(worldX, w.x) * w.strength);
  }
  return g;
}

/**
 * The wave itself: a bright compression front with dust piled against it.
 *
 * Deliberately restrained. The corn bending is doing most of the work of
 * telling the player what is happening, and a big white bar would bury it.
 */
export function drawWave(
  ctx: Ctx, f: Frame, waves: readonly Wave[],
  toScreen: (worldX: number) => number,
): void {
  for (const w of waves) {
    if (!w.launched) continue;
    const sx = toScreen(w.x);
    const band = WAVE.band * f.w;
    if (sx < -band * 4 || sx > f.w + band * 4) continue;

    const top = HORIZON * f.h * 0.86;
    const bottom = CORN_FORE.base * f.h;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // The front edge, and a wake of compressed air trailing it.
    const grad = ctx.createLinearGradient(sx - band * 2.4, 0, sx + band * 0.7, 0);
    grad.addColorStop(0, rgba(LIGHT, 0));
    grad.addColorStop(0.62, rgba(LIGHT, 0.05 * w.strength));
    grad.addColorStop(0.88, rgba(LIGHT, 0.15 * w.strength));
    grad.addColorStop(1, rgba(LIGHT, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(sx - band * 2.4, top, band * 3.1, bottom - top);

    // A brighter line right at the front, low down where the dust is thickest.
    const lip = ctx.createLinearGradient(0, GROUND_Y * f.h - f.h * 0.22, 0, bottom);
    lip.addColorStop(0, rgba(LIGHT, 0));
    lip.addColorStop(1, rgba(LIGHT, 0.17 * w.strength));
    ctx.fillStyle = lip;
    ctx.filter = `blur(${5 * f.u}px)`;
    ctx.fillRect(sx - band * 0.5, GROUND_Y * f.h - f.h * 0.22, band * 0.85, f.h * 0.3);

    ctx.restore();
  }
}

export type Grit = { x: number; y: number; vx: number; vy: number; life: number };

/** Debris torn off the ground and carried along the front. */
export function spawnGrit(out: Grit[], f: Frame, sx: number, strength: number): void {
  for (let i = 0; i < 14; i += 1) {
    out.push({
      x: sx + (Math.random() - 0.5) * f.w * 0.12,
      y: GROUND_Y * f.h - Math.random() * f.h * 0.14,
      vx: (1.6 + Math.random() * 2.6) * strength * f.w * 0.006,
      vy: -(Math.random() * 0.9) * f.h * 0.004,
      life: 0.7 + Math.random() * 0.8,
    });
  }
}

export function drawGrit(ctx: Ctx, f: Frame, grit: Grit[], dt: number): void {
  ctx.save();
  ctx.fillStyle = rgba(LIGHT, 0.5);
  for (let i = grit.length - 1; i >= 0; i -= 1) {
    const g = grit[i];
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vy += 0.00035 * f.h * dt;
    g.life -= dt / 60;
    if (g.life <= 0 || g.x > f.w * 1.2) {
      grit.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.min(0.55, g.life) * 0.7;
    ctx.fillRect(g.x, g.y, 1.6 * f.u, 1.6 * f.u);
  }
  ctx.restore();
}
