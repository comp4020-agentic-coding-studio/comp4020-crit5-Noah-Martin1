// Sound, synthesised.
//
// Nothing here loads a file. The whole soundtrack is WebAudio nodes, which
// keeps the site a static build with no asset pipeline, no download to wait on,
// and no licensing — and it means the shockwave's roar can be *derived* from
// the same number that bends the corn rather than triggered near it.
//
// Browsers refuse to start audio without a gesture, so nothing is created until
// the player's first input. Before that this object is inert.

type Nodes = {
  ctx: AudioContext;
  master: GainNode;
  bed: GainNode;
  windFilter: BiquadFilterNode;
  noise: AudioBuffer;
};

export type Audio = {
  /** Safe to call on every input; only the first one does anything. */
  start: () => void;
  detonate: () => void;
  /** Called when a wave launches: a swell that arrives with it. */
  wave: (strength: number, seconds: number) => void;
  thud: () => void;
  /** The last ten seconds: a rising bed and a clock you cannot ignore. */
  riser: (seconds: number) => void;
  /** The picture going out. Everything lands at once, then nothing. */
  blackout: () => void;
  /** Knocked cold: everything muffles and a ring takes over. */
  concussion: (seconds: number) => void;
  /** 0..1 — tightens the ambient bed as the clock runs down. */
  tension: (v: number) => void;
  mute: () => void;
};

function brownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i += 1) {
    // Brown rather than white: the spectrum of wind and of distant weather,
    // and it sits under the picture instead of hissing over it.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function source(n: Nodes, loop: boolean): AudioBufferSourceNode {
  const src = n.ctx.createBufferSource();
  src.buffer = n.noise;
  src.loop = loop;
  return src;
}

export function makeAudio(): Audio {
  let n: Nodes | null = null;
  let tensionV = 0;

  const build = (): Nodes | null => {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const noise = brownNoise(ctx, 3);

    // --- the bed: wind, and a drone under it ------------------------------
    const bed = ctx.createGain();
    bed.gain.value = 0.0001;
    bed.connect(master);

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    windFilter.connect(bed);

    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    wind.connect(windFilter);
    wind.start();

    // A slow breath on the wind so it never sits still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();

    // Two drones a fifth apart, barely audible, to give the field a floor.
    for (const [hz, gain] of [[55, 0.05], [82.5, 0.03]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(bed);
      osc.start();
    }

    bed.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 4);
    return { ctx, master, bed, windFilter, noise };
  };

  const start = (): void => {
    if (n) {
      if (n.ctx.state === "suspended") void n.ctx.resume();
      return;
    }
    n = build();
  };

  const detonate = (): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;

    // The flash arrives long before the sound does. Two and a half seconds of
    // silence, then the whole horizon at once — the distance is the drama.
    const delay = 2.4;

    const burst = source(n, false);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, t + delay);
    lp.frequency.exponentialRampToValueAtTime(70, t + delay + 3.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.85, t + delay + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 4.5);
    burst.connect(lp).connect(g).connect(n.master);
    burst.start(t + delay);
    burst.stop(t + delay + 5);

    // The concussion under it, swept down so it reads as pressure not as a note.
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(58, t + delay);
    sub.frequency.exponentialRampToValueAtTime(19, t + delay + 2.4);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t + delay);
    sg.gain.exponentialRampToValueAtTime(0.7, t + delay + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + delay + 3);
    sub.connect(sg).connect(n.master);
    sub.start(t + delay);
    sub.stop(t + delay + 3.2);
  };

  const wave = (strength: number, seconds: number): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;

    // A roar that grows for exactly as long as the wave takes to arrive, so the
    // ear and the eye are given the same warning.
    const src = source(n, true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(90, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + seconds);
    bp.frequency.exponentialRampToValueAtTime(120, t + seconds + 1.4);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * strength, t + seconds);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 1.8);

    src.connect(bp).connect(g).connect(n.master);
    src.start(t);
    src.stop(t + seconds + 2);
  };

  const thud = (): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(n.master);
    osc.start(t);
    osc.stop(t + 0.55);
  };

  const riser = (seconds: number): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;

    // A tone climbing most of an octave over the whole ten seconds. Slow enough
    // that you feel it before you notice it.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + seconds);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2200, t + seconds);
    lp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + seconds * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.35);
    osc.connect(lp).connect(g).connect(n.master);
    osc.start(t);
    osc.stop(t + seconds + 0.5);

    // And a clock. One tick a second, each harder than the last — the only
    // thing in the piece that counts out loud.
    for (let i = 0; i < Math.floor(seconds); i += 1) {
      const at = t + i;
      const k = i / Math.max(1, seconds - 1);
      const tick = ctx.createOscillator();
      tick.type = "square";
      tick.frequency.setValueAtTime(880 + k * 420, at);
      const tg = ctx.createGain();
      tick.connect(tg).connect(n.master);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1600;
      bp.Q.value = 2;
      tg.disconnect();
      tg.connect(bp).connect(n.master);
      tg.gain.setValueAtTime(0.0001, at);
      tg.gain.exponentialRampToValueAtTime(0.05 + 0.16 * k, at + 0.006);
      tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      tick.start(at);
      tick.stop(at + 0.12);
    }
  };

  const blackout = (): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;

    // Everything at once: a slam, a sub drop, and then the whole mix pulled out
    // from under it. The silence afterwards is the point.
    const slam = source(n, false);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4000, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    slam.connect(lp).connect(g).connect(n.master);
    slam.start(t);
    slam.stop(t + 3.6);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(16, t + 2.6);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.9, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    sub.connect(sg).connect(n.master);
    sub.start(t);
    sub.stop(t + 3.2);

    // The bed does not survive it.
    n.bed.gain.setTargetAtTime(0.0001, t + 0.4, 0.7);
  };

  const concussion = (seconds: number): void => {
    if (!n) return;
    const { ctx } = n;
    const t = ctx.currentTime;

    // Tinnitus. The field goes away and is replaced by a tone, which is a
    // better way of saying "you have been knocked out" than any caption.
    const ring = ctx.createOscillator();
    ring.type = "sine";
    ring.frequency.setValueAtTime(3450, t);
    ring.frequency.linearRampToValueAtTime(3050, t + seconds);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.085, t + 0.06);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    ring.connect(rg).connect(n.master);
    ring.start(t);
    ring.stop(t + seconds + 0.2);

    // And everything else ducks away under it, then comes back.
    n.master.gain.cancelScheduledValues(t);
    n.master.gain.setValueAtTime(n.master.gain.value, t);
    n.master.gain.linearRampToValueAtTime(0.22, t + 0.12);
    n.master.gain.linearRampToValueAtTime(0.9, t + seconds);
  };

  const tension = (v: number): void => {
    if (!n) return;
    const clamped = Math.max(0, Math.min(1, v));
    if (Math.abs(clamped - tensionV) < 0.02) return;
    tensionV = clamped;
    // The bed rises and opens up as the clock runs down. Nothing announces it;
    // it just gets harder to sit still in.
    n.windFilter.frequency.setTargetAtTime(420 + clamped * 900, n.ctx.currentTime, 0.6);
    n.bed.gain.setTargetAtTime(0.16 + clamped * 0.2, n.ctx.currentTime, 0.8);
  };

  const mute = (): void => {
    if (!n) return;
    n.master.gain.setTargetAtTime(0.0001, n.ctx.currentTime, 0.4);
  };

  return { start, detonate, wave, thud, riser, blackout, concussion, tension, mute };
}
