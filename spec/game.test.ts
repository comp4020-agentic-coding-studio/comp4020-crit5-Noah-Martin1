import { describe, expect, it } from "vitest";
import { makeGame, update, RABBIT_HALF } from "../scene/game.ts";
import type { Game, Input } from "../scene/game.ts";
import {
  BLAST_DELAY,
  BURROW_AT,
  GRAVITY,
  GROUND_Y,
  JUMP_V,
  LEVEL_LEN,
  PROPS,
  RUN_SPEED,
  RUN_TIME,
  WAVE,
  WAVE_AT,
} from "../scene/layout.ts";
import {
  COVERS,
  REACH_IN_WARNING,
  blockedBy,
  burrowInReach,
  trapAt,
  clampX,
  clears,
  secondsToBurrow,
  shelteredBy,
  worstCoverGap,
} from "../scene/rules.ts";

// Contract tests for this week's brief. They retire with it; the sensors in
// scene.test.ts do not.

const IDLE: Input = {
  left: false, right: false, jumpEdge: false, diveEdge: false, anyEdge: false,
};
const RUN: Input = { ...IDLE, right: true };
const STEP = 1 / 60;

/** Drive the real loop for a number of seconds, with a per-frame input. */
function play(seconds: number, choose: (g: Game, i: number) => Input = () => RUN): Game {
  const game = makeGame(1234);
  for (let i = 0; i < seconds * 60; i += 1) update(game, choose(game, i), STEP);
  return game;
}

describe("cover is the only thing that saves you", () => {
  // The one rule the whole game turns on. Everything else is scenery.

  it("shelters a rabbit on the lee side of a drum", () => {
    expect(shelteredBy(COVERS[0].x + 0.1)).toBeTruthy();
  });

  it("does not shelter one standing in the open", () => {
    expect(shelteredBy(COVERS[0].x + 0.9)).toBeNull();
  });

  it("does not shelter one on the blast side of the same object", () => {
    // The blast always comes from -x. Standing in front of the drum is not
    // cover, and it does not look like cover either.
    expect(shelteredBy(COVERS[0].x - 0.4)).toBeNull();
  });

  it("knocks down a rabbit the wave catches in the open, and not one behind cover", () => {
    // The same wave, the same instant, two positions. Drives the real update
    // loop rather than calling the rule directly, so the schedule, the
    // propagation and the rule all have to agree.
    const runUntilFirstWaveLands = (parkAt: number): Game => {
      const game = makeGame(1234);
      for (let i = 0; i < 60 * 60; i += 1) {
        game.rabbit.x = parkAt;
        game.rabbit.vx = 0;
        update(game, i === 0 ? RUN : IDLE, STEP);
        if (game.waves[0].spent) break;
      }
      return game;
    };

    const exposed = runUntilFirstWaveLands(COVERS[1].x - 1.0);
    const sheltered = runUntilFirstWaveLands(COVERS[1].x + 0.1);

    expect(exposed.waves[0].spent).toBe(true);
    expect(sheltered.waves[0].spent).toBe(true);
    expect(exposed.rabbit.stun).toBeGreaterThan(0);
    expect(sheltered.rabbit.stun).toBe(0);
    expect(sheltered.rabbit.flinch).toBeGreaterThan(0);
  });
});

describe("the level is fair", () => {
  it("never puts cover further away than the warning allows", () => {
    // The sensor that matters. A wave gives WAVE.warn seconds of notice; if the
    // player can be further from cover than they can run in that time, the wave
    // is undodgeable through no fault of theirs — and nothing on screen would
    // show it. This is what stops a prop edit from quietly breaking the game.
    expect(worstCoverGap()).toBeLessThan(REACH_IN_WARNING);
  });

  it("leaves real margin, not a photo finish", () => {
    expect(worstCoverGap()).toBeLessThan(REACH_IN_WARNING * 0.8);
  });

  it("starts the rabbit within reach of the first cover", () => {
    expect(COVERS[0].x).toBeLessThan(REACH_IN_WARNING + WAVE_AT[0] * RUN_SPEED);
  });

  it("keeps every prop on the level", () => {
    for (const p of PROPS) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(LEVEL_LEN);
    }
  });
});

describe("small things are jumped, not walked through", () => {
  const apex = (JUMP_V * JUMP_V) / (2 * GRAVITY);
  const obstacles = PROPS.filter((p) => !p.cover);

  it("blocks a rabbit that runs into a log at ground height", () => {
    const log = obstacles[0];
    expect(blockedBy(log.x, RABBIT_HALF, GROUND_Y)).toBeTruthy();
  });

  it("lets one pass over the top of it", () => {
    const log = obstacles[0];
    expect(blockedBy(log.x, RABBIT_HALF, GROUND_Y - apex)).toBeNull();
  });

  it("keeps every obstacle inside a jump, with room for a late one", () => {
    // If an obstacle were taller than the apex it would simply be a wall.
    for (const p of obstacles) {
      expect(p.height).toBeLessThan(apex * 0.75);
    }
  });

  it("agrees with clears about where the line is", () => {
    const p = obstacles[0];
    expect(clears(GROUND_Y - p.height - 0.001, p.height)).toBe(true);
    expect(clears(GROUND_Y - p.height + 0.001, p.height)).toBe(false);
  });
});

describe("a trap ends the run", () => {
  const traps = PROPS.filter((p) => p.kind === "trap");
  const apex = (JUMP_V * JUMP_V) / (2 * GRAVITY);

  it("puts traps in the field at all", () => {
    expect(traps.length).toBeGreaterThan(0);
  });

  it("springs on a rabbit that walks over one", () => {
    expect(trapAt(traps[0].x, RABBIT_HALF, GROUND_Y)).toBeTruthy();
  });

  it("is cleared by any jump at all", () => {
    // The difficulty is seeing them, not timing them.
    expect(trapAt(traps[0].x, RABBIT_HALF, GROUND_Y - apex * 0.25)).toBeNull();
  });

  it("does not block the way like a log does", () => {
    expect(blockedBy(traps[0].x, RABBIT_HALF, GROUND_Y)).toBeNull();
  });

  it("never sits where a sheltering rabbit would be standing", () => {
    // Dying while correctly taking cover would be a lie about the rules.
    for (const t of traps) {
      expect(shelteredBy(t.x)).toBeNull();
    }
  });

  it("kills, rather than costing time", () => {
    // Walked straight onto one, rather than run at from the start: a rabbit
    // that never jumps is stopped by the first log long before it reaches a trap.
    const game = makeGame(1234);
    update(game, { ...RUN, anyEdge: true }, STEP);
    game.rabbit.x = traps[0].x - 0.04;
    for (let i = 0; i < 120 && game.phase === "running"; i += 1) {
      update(game, RUN, STEP);
    }
    expect(game.phase).toBe("lost");
    expect(game.death).toBe("trap");
  });
});

describe("the blast, and the clock it starts", () => {
  it("waits: nothing happens until the player moves", () => {
    const game = play(9, () => IDLE);
    expect(game.phase).toBe("idle");
    expect(game.blast.t).toBeNull();
    expect(game.timeLeft).toBe(RUN_TIME);
  });

  it("goes off five seconds after the first movement, not before", () => {
    expect(play(BLAST_DELAY - 0.7).blast.t).toBeNull();
    expect(play(BLAST_DELAY + 0.7).blast.t).not.toBeNull();
  });

  it("starts the countdown at the flash and not at the first step", () => {
    const game = play(BLAST_DELAY - 0.7);
    expect(game.timeLeft).toBe(RUN_TIME);
    const later = play(BLAST_DELAY + 2);
    expect(later.timeLeft).toBeLessThan(RUN_TIME);
    expect(later.timeLeft).toBeGreaterThan(RUN_TIME - 3);
  });

  it("loses when the clock runs out", () => {
    // A rabbit that starts and then stands still runs out of field time.
    const game = play(BLAST_DELAY + RUN_TIME + 1, (_g, i) => (i === 0 ? RUN : IDLE));
    expect(game.phase).toBe("lost");
  });
});

describe("the burrow can be reached in time", () => {
  it("is at the far end of the level", () => {
    expect(BURROW_AT).toBeGreaterThan(LEVEL_LEN * 0.9);
    expect(BURROW_AT).toBeLessThanOrEqual(LEVEL_LEN);
  });

  it("is inside the countdown with room for the waves", () => {
    // Flat-out running from the start, plus what the three waves cost.
    const running = secondsToBurrow(clampX(0));
    expect(running).toBeLessThan(RUN_TIME - WAVE_AT.length * 3);
  });

  it("takes when the rabbit arrives, with no dive to time", () => {
    expect(burrowInReach(BURROW_AT)).toBe(true);
    expect(burrowInReach(BURROW_AT - 0.5)).toBe(false);
  });

  it("is beatable by a player who runs, jumps and takes cover", () => {
    // The winnability sensor: the whole game, played end to end by a bot that
    // only knows the three things the piece teaches by looking.
    const game = play(BLAST_DELAY + RUN_TIME, (g) => {
      const r = g.rabbit;
      // Jump anything small in the way — logs, rocks, fences, and the traps,
      // which are the one thing here that does not forgive.
      const ahead = PROPS.find(
        (p) => !p.cover && p.x - r.x > 0 && p.x - r.x < 0.22,
      );
      const jumpEdge = Boolean(ahead) && !r.airborne;

      const threat = g.waves.find((w) => w.launched && !w.spent);
      if (threat) {
        if (shelteredBy(r.x)) return { ...IDLE };
        // Prefer cover that is on the way. Doubling back costs the run twice:
        // once going and once coming again.
        let best = COVERS[0];
        let bestCost = Infinity;
        for (const c of COVERS) {
          const d = c.x + 0.1 - r.x;
          const cost = d >= 0 ? d : -d * 2.2;
          if (cost < bestCost) {
            bestCost = cost;
            best = c;
          }
        }
        const gap = best.x + 0.1 - r.x;
        return { ...IDLE, left: gap < -0.02, right: gap > 0.02, jumpEdge };
      }
      return { ...RUN, jumpEdge };
    });

    expect(game.phase).toBe("escaped");
    expect(game.timeLeft).toBeGreaterThan(0);
  });
});
