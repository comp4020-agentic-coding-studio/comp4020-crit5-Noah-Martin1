// The only text in the piece, and the only interface.
//
// Drawn on the canvas rather than in the DOM so it scales with the frame, sits
// under the same grain and vignette as everything else, and reads as a thing
// bolted to the world rather than a browser element floating over it.

import type { Ctx, Frame } from "./draw.ts";
import { LIGHT, RIBBON, RIBBON_LIT, rgba } from "./palette.ts";

const FACE = '"Courier New", ui-monospace, monospace';

function clockText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Letter-spaced text, drawn a glyph at a time.
 *
 * `ctx.letterSpacing` exists but is not everywhere, and tracking is most of
 * what makes this read as stencilled onto equipment rather than typed.
 */
function tracked(ctx: Ctx, text: string, x: number, y: number, track: number): number {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  return cx - track;
}

function trackedWidth(ctx: Ctx, text: string, track: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + track;
  return w - track;
}

/**
 * The countdown, top right.
 *
 * Urgency is one number driving four things at once — glow, weight, a pulse and
 * a jitter — because any one of them alone either goes unnoticed or becomes
 * obnoxious, and the brief asked for neither.
 */
export function drawTimer(ctx: Ctx, f: Frame, secondsLeft: number, t: number): void {
  const text = clockText(secondsLeft);
  const urgency = Math.max(0, Math.min(1, (10 - secondsLeft) / 10));
  const pulse = urgency > 0 ? 0.5 + 0.5 * Math.sin(t * (5 + urgency * 5)) : 0;

  const size = f.h * (0.052 + 0.006 * urgency * pulse);
  const track = size * 0.10;
  const pad = f.h * 0.036;

  ctx.save();
  ctx.font = `${size}px ${FACE}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const w = trackedWidth(ctx, text, track);
  const x = f.w - pad - w;
  const y = pad;

  // Bracket frame: two corners rather than a box, which would read as UI.
  const bw = w + size * 0.42;
  const bh = size * 1.12;
  const bx = x - size * 0.21;
  const by = y - size * 0.06;
  const arm = size * 0.3;
  ctx.strokeStyle = rgba(RIBBON, 0.34 + 0.4 * urgency * pulse);
  ctx.lineWidth = Math.max(1, 1.6 * f.u);
  ctx.beginPath();
  ctx.moveTo(bx, by + arm); ctx.lineTo(bx, by); ctx.lineTo(bx + arm, by);
  ctx.moveTo(bx + bw - arm, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - arm);
  ctx.stroke();

  // The digits. Jitter only at the very end, and only by a fraction of a pixel.
  const jx = urgency > 0.55 ? (Math.random() - 0.5) * urgency * 2.2 * f.u : 0;
  ctx.shadowColor = rgba(RIBBON_LIT, 0.85);
  ctx.shadowBlur = (size * 0.22) * (0.5 + urgency * (0.7 + pulse * 0.8));
  ctx.fillStyle = RIBBON_LIT;
  tracked(ctx, text, x + jx, y, track);
  // A second pass thickens the glyphs as time runs out without changing weight.
  if (urgency > 0.3) {
    ctx.globalAlpha = 0.55 * urgency;
    tracked(ctx, text, x + jx, y, track);
  }
  ctx.restore();

  // Distress: a couple of thin rows knocked out of the digits, like a failing
  // segment display. Cheap, and it stops the type looking freshly rendered.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const at of [0.34, 0.66]) {
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, by + bh * at, bw, Math.max(1, 1.1 * f.u));
  }
  ctx.restore();
}

/** Shared chrome for both endings: quiet, tracked, centred, small. */
function endCard(
  ctx: Ctx, f: Frame, p: number, head: string, sub: string, tone: string,
): void {
  const a = Math.max(0, Math.min(1, p));
  if (a <= 0) return;

  // A scrim, or the type competes with the corn behind it. Centred on the text
  // and feathered out, so it darkens without reading as a panel.
  ctx.save();
  const scrim = ctx.createRadialGradient(
    f.w / 2, f.h * 0.53, 0, f.w / 2, f.h * 0.53, f.w * 0.42,
  );
  scrim.addColorStop(0, `rgba(4, 7, 10, ${0.62 * a})`);
  scrim.addColorStop(0.6, `rgba(4, 7, 10, ${0.4 * a})`);
  scrim.addColorStop(1, "rgba(4, 7, 10, 0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const size = f.h * 0.042;
  const track = size * 0.42;
  ctx.font = `${size}px ${FACE}`;
  const w = trackedWidth(ctx, head, track);
  ctx.globalAlpha = a;
  ctx.shadowColor = rgba(tone, 0.6);
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = tone;
  tracked(ctx, head, (f.w - w) / 2, f.h * 0.46, track);

  const s2 = f.h * 0.024;
  const t2 = s2 * 0.34;
  ctx.font = `${s2}px ${FACE}`;
  ctx.shadowBlur = 0;
  ctx.globalAlpha = a * 0.72;
  ctx.fillStyle = rgba(LIGHT, 0.8);
  const w2 = trackedWidth(ctx, sub, t2);
  tracked(ctx, sub, (f.w - w2) / 2, f.h * 0.535, t2);

  // The prompt fades in last and breathes, so it reads as an invitation rather
  // than a button.
  if (a > 0.85) {
    const s3 = f.h * 0.018;
    const t3 = s3 * 0.5;
    ctx.font = `${s3}px ${FACE}`;
    ctx.globalAlpha = 0.3 + 0.22 * Math.sin(p * 2.2);
    const w3 = trackedWidth(ctx, "AGAIN", t3);
    tracked(ctx, "AGAIN", (f.w - w3) / 2, f.h * 0.63, t3);
  }
  ctx.restore();
}

export function drawSurvived(ctx: Ctx, f: Frame, secondsLeft: number, p: number): void {
  endCard(ctx, f, p, "SURVIVED", `${clockText(secondsLeft)} REMAINING`, LIGHT);
}

export function drawLost(
  ctx: Ctx, f: Frame, p: number, cause: "clock" | "trap" | null,
): void {
  if (cause === "trap") {
    endCard(ctx, f, p, "THE FIELD WAS SET", "SOMETHING WAS HERE FIRST", RIBBON_LIT);
    return;
  }
  endCard(ctx, f, p, "CAUGHT IN THE OPEN", "THE FIELD WAS TOO LONG", RIBBON_LIT);
}

/**
 * Being knocked out, from the inside. `p` runs 1 to 0 over the stun.
 *
 * No stars and no "STUNNED" caption — the piece has no captions. The frame
 * closes in, the edges pulse with the only red in the palette, and it slowly
 * opens back up as the rabbit comes round. It is the same language the rest of
 * the scene uses: you are told what happened by what you can and cannot see.
 */
export function drawConcussion(ctx: Ctx, f: Frame, p: number, t: number): void {
  const a = Math.max(0, Math.min(1, p));
  if (a <= 0.01) return;
  const pulse = 0.72 + 0.28 * Math.sin(t * 6.5);

  ctx.save();
  const close = ctx.createRadialGradient(
    f.w / 2, f.h * 0.62, f.h * 0.06,
    f.w / 2, f.h * 0.62, f.h * (1.05 - 0.45 * a),
  );
  close.addColorStop(0, "rgba(0,0,0,0)");
  close.addColorStop(0.45, `rgba(5,4,5,${0.4 * a})`);
  close.addColorStop(1, `rgba(2,2,3,${0.94 * a})`);
  ctx.fillStyle = close;
  ctx.fillRect(0, 0, f.w, f.h);

  // A slow red throb right at the edge — blood in the ears, not a HUD.
  const beat = ctx.createRadialGradient(
    f.w / 2, f.h * 0.62, f.h * (0.5 - 0.15 * a),
    f.w / 2, f.h * 0.62, f.h * 1.0,
  );
  beat.addColorStop(0, rgba(RIBBON, 0));
  beat.addColorStop(1, rgba(RIBBON, 0.3 * a * pulse));
  ctx.fillStyle = beat;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}
