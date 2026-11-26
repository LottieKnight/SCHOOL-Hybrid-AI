import type { ResearchTrialEventInput, ResearchTrialEventType } from "@saedu/shared";

/**
 * Renderer for the "Observational Silence v1" stimulus.
 * Framework-agnostic: give it a <canvas> and handlers; it draws the trial and
 * emits the experiment-clock event stream. See
 * docs/research/stimulus-observational-silence-v1.md.
 *
 * SCAFFOLD: trajectories/timing are ported from the reference prototype. For a
 * production study, seed the RNG (so trials are reproducible) and drive the
 * config from research_studies.config.
 */

/** Intruder hue is an experimental condition (the attentional-set manipulation). */
export type IntruderCondition = "magenta" | "teal_matched" | "amber_matched";

export interface IntruderSalience {
  sizeMult: number; // 1.0 = baseline radius (26)
  rotationMult: number; // 1.0 = baseline spin
  opacity: number; // 0..1 — lower is harder to see
}

export interface StimulusConfig {
  durationMs: number;
  intruder: {
    onsetMs: number;
    centerMs: number;
    dwellEndMs: number;
    offsetMs: number;
    condition: IntruderCondition;
    fill: string;
    accent: string;
    salience: IntruderSalience;
  };
  backdropShift: { onsetMs: number; offsetMs: number };
  agentExit: { onsetMs: number; agentIndex: number };
}

/**
 * Geometry/timing are identical across conditions — only the intruder hue
 * changes. Noticing should rise when the intruder matches the ATTENDED (teal)
 * group, and the teal-matched arm doubles as a camouflage interpretation.
 */
export const INTRUDER_CONDITIONS: Record<IntruderCondition, { fill: string; accent: string }> = {
  magenta: { fill: "#D4537E", accent: "#ED93B1" }, // neutral / distinct baseline
  teal_matched: { fill: "#1D9E75", accent: "#5DCAA5" }, // matches the counted group
  amber_matched: { fill: "#EF9F27", accent: "#BA7517" }, // matches the ignored group
};

/** Baseline salience — do NOT raise size/opacity without re-validating the ~50% miss rate. */
export const BASELINE_SALIENCE: IntruderSalience = { sizeMult: 1, rotationMult: 1, opacity: 0.92 };

export const DEFAULT_STIMULUS_CONFIG: StimulusConfig = {
  durationMs: 22000,
  intruder: {
    onsetMs: 7500,
    centerMs: 9500,
    dwellEndMs: 11500,
    offsetMs: 13500,
    condition: "magenta",
    fill: INTRUDER_CONDITIONS.magenta.fill,
    accent: INTRUDER_CONDITIONS.magenta.accent,
    salience: BASELINE_SALIENCE,
  },
  backdropShift: { onsetMs: 16000, offsetMs: 17500 },
  agentExit: { onsetMs: 21000, agentIndex: 5 },
};

/** Builds a config for an intruder condition, holding all timing/geometry fixed. */
export function configForCondition(condition: IntruderCondition): StimulusConfig {
  const c = INTRUDER_CONDITIONS[condition];
  return {
    ...DEFAULT_STIMULUS_CONFIG,
    intruder: { ...DEFAULT_STIMULUS_CONFIG.intruder, condition, fill: c.fill, accent: c.accent },
  };
}

/** Frame-timing summary — timing is data, so flag trials rendered on struggling devices. */
export interface TrialQuality {
  avgFps: number;
  droppedFrames: number;
  frameCount: number;
  clockDriftMs: number;
}

export interface StimulusHandlers {
  onEvent: (event: ResearchTrialEventInput) => void;
  onEnd: (summary: { actualPassCount: number; quality: TrialQuality }) => void;
}

interface Agent {
  team: "teal" | "amber";
  x: number;
  y: number;
  tx: number;
  ty: number;
}

interface Pass {
  from: number;
  to: number;
  start: number;
}

const COLORS = {
  teal: "#1D9E75",
  teal2: "#5DCAA5",
  amber: "#EF9F27",
  amber2: "#BA7517",
  token: "#E1F5EE",
};

const W = 640;
const H = 380;
const AX0 = 56;
const AX1 = 584;
const AY0 = 64;
const AY1 = 320;
const PASS_MS = 600;
const DROPPED_FRAME_DT = 0.034; // a frame slower than ~30fps counts as dropped

export class ObservationalSilenceStimulus {
  private ctx: CanvasRenderingContext2D;
  private cfg: StimulusConfig;
  private handlers: StimulusHandlers;

  private agents: Agent[] = [];
  private tealHolder = 0;
  private amberHolder = 3;
  private tealPass: Pass | null = null;
  private amberPass: Pass | null = null;
  private actualPassCount = 0;
  private nextTeal = 1200;
  private nextAmber = 1700;

  private t0 = 0;
  private lastFrame = 0;
  private raf = 0;
  private running = false;
  private seq = 0;
  private fired = new Set<string>();
  private frameCount = 0;
  private droppedFrames = 0;

  constructor(canvas: HTMLCanvasElement, config: StimulusConfig, handlers: StimulusHandlers) {
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.scale(dpr, dpr);
    this.ctx = ctx;
    this.cfg = config;
    this.handlers = handlers;
    this.reset();
  }

  start() {
    if (this.running) return;
    this.reset();
    this.t0 = performance.now();
    this.lastFrame = this.t0;
    this.running = true;
    this.emit("stimulus_onset", { stimulusVersion: "v1", condition: this.cfg.intruder.condition });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
  }

  getActualPassCount() {
    return this.actualPassCount;
  }

  private onVisibility = () => {
    if (!this.running) return;
    this.emit(document.hidden ? "focus_lost" : "focus_gained");
  };

  private emit(eventType: ResearchTrialEventType, payload: Record<string, unknown> = {}) {
    this.handlers.onEvent({
      seq: this.seq++,
      eventType,
      eventTimeMs: Math.round(performance.now() - this.t0),
      clientTs: new Date().toISOString(),
      payload,
    });
  }

  private fireOnce(key: string, eventType: ResearchTrialEventType, payload: Record<string, unknown>) {
    if (this.fired.has(key)) return;
    this.fired.add(key);
    this.emit(eventType, payload);
  }

  private rnd(a: number, b: number) {
    return a + Math.random() * (b - a);
  }

  private ease(t: number) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private reset() {
    const mk = (team: "teal" | "amber"): Agent => ({
      team,
      x: this.rnd(AX0, AX1),
      y: this.rnd(AY0, AY1),
      tx: this.rnd(AX0, AX1),
      ty: this.rnd(AY0, AY1),
    });
    this.agents = [mk("teal"), mk("teal"), mk("teal"), mk("amber"), mk("amber"), mk("amber")];
    this.tealHolder = 0;
    this.amberHolder = 3;
    this.tealPass = null;
    this.amberPass = null;
    this.actualPassCount = 0;
    this.nextTeal = 1200;
    this.nextAmber = 1700;
    this.seq = 0;
    this.fired.clear();
    this.frameCount = 0;
    this.droppedFrames = 0;
  }

  private startPass(team: "teal" | "amber") {
    if (team === "teal") {
      const opts = [0, 1, 2].filter((i) => i !== this.tealHolder);
      const to = opts[Math.floor(Math.random() * opts.length)];
      this.tealPass = { from: this.tealHolder, to, start: performance.now() };
      this.actualPassCount++;
    } else {
      const opts = [3, 4, 5].filter((i) => i !== this.amberHolder);
      const to = opts[Math.floor(Math.random() * opts.length)];
      this.amberPass = { from: this.amberHolder, to, start: performance.now() };
    }
  }

  private moveAgent(a: Agent, dt: number) {
    const dx = a.tx - a.x;
    const dy = a.ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      a.tx = this.rnd(AX0, AX1);
      a.ty = this.rnd(AY0, AY1);
    } else {
      const s = Math.min(d, 62 * dt);
      a.x += (dx / d) * s;
      a.y += (dy / d) * s;
    }
  }

  private tokenPos(pass: Pass | null, holder: number) {
    if (!pass) return { x: this.agents[holder].x, y: this.agents[holder].y };
    const p = Math.min(1, (performance.now() - pass.start) / PASS_MS);
    const e = this.ease(p);
    const f = this.agents[pass.from];
    const t = this.agents[pass.to];
    return { x: f.x + (t.x - f.x) * e, y: f.y + (t.y - f.y) * e };
  }

  private drawOrb(a: Agent) {
    const c = this.ctx;
    c.beginPath();
    c.arc(a.x, a.y, 18, 0, Math.PI * 2);
    c.fillStyle = a.team === "teal" ? COLORS.teal : COLORS.amber;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = a.team === "teal" ? COLORS.teal2 : COLORS.amber2;
    c.stroke();
  }

  private drawDot(p: { x: number; y: number }) {
    const c = this.ctx;
    c.beginPath();
    c.arc(p.x, p.y, 6, 0, Math.PI * 2);
    c.fillStyle = COLORS.token;
    c.fill();
  }

  private drawKite(cx: number, cy: number, r: number, rot: number) {
    const c = this.ctx;
    const it = this.cfg.intruder;
    c.save();
    c.globalAlpha = it.salience.opacity;
    c.translate(cx, cy);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rr = i % 2 ? r * 0.42 : r;
      c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    c.closePath();
    c.fillStyle = it.fill;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = it.accent;
    c.stroke();
    c.restore();
  }

  private drawField(el: number) {
    const c = this.ctx;
    let base = [15, 21, 18];
    const s = this.cfg.backdropShift;
    if (el > s.onsetMs) {
      const k = Math.min(1, (el - s.onsetMs) / Math.max(1, s.offsetMs - s.onsetMs));
      base = [15 + 10 * k, 21 - 6 * k, 18 - 16 * k];
    }
    c.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "rgba(255,255,255,0.06)";
    c.lineWidth = 1;
    c.strokeRect(8, 8, W - 16, H - 16);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const el = now - this.t0;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frameCount++;
    if (dt > DROPPED_FRAME_DT) this.droppedFrames++;

    this.drawField(el);

    if (el > this.nextTeal && !this.tealPass) {
      this.startPass("teal");
      this.nextTeal = el + PASS_MS + this.rnd(1000, 1500);
    }
    if (el > this.nextAmber && !this.amberPass) {
      this.startPass("amber");
      this.nextAmber = el + PASS_MS + this.rnd(900, 1400);
    }
    if (this.tealPass && performance.now() - this.tealPass.start >= PASS_MS) {
      this.tealHolder = this.tealPass.to;
      this.tealPass = null;
    }
    if (this.amberPass && performance.now() - this.amberPass.start >= PASS_MS) {
      this.amberHolder = this.amberPass.to;
      this.amberPass = null;
    }

    const bs = this.cfg.backdropShift;
    if (el >= bs.onsetMs) this.fireOnce("backdrop_on", "anomaly_onset", { criticalEventKey: "backdrop_shift" });
    if (el >= bs.offsetMs) this.fireOnce("backdrop_off", "anomaly_offset", { criticalEventKey: "backdrop_shift" });

    const ax = this.cfg.agentExit;
    const agentExited = el >= ax.onsetMs;
    if (agentExited) this.fireOnce("agent_exit_on", "anomaly_onset", { criticalEventKey: "agent_exit" });

    for (let i = 0; i < this.agents.length; i++) {
      if (agentExited && i === ax.agentIndex) continue;
      this.moveAgent(this.agents[i], dt);
      this.drawOrb(this.agents[i]);
    }
    this.drawDot(this.tokenPos(this.tealPass, this.tealHolder));
    this.drawDot(this.tokenPos(this.amberPass, this.amberHolder));

    const it = this.cfg.intruder;
    if (el >= it.onsetMs && el <= it.offsetMs) {
      this.fireOnce("intruder_on", "anomaly_onset", { criticalEventKey: "intruder", condition: it.condition });
      let ix: number;
      if (el < it.centerMs) ix = 700 + (320 - 700) * this.ease((el - it.onsetMs) / (it.centerMs - it.onsetMs));
      else if (el < it.dwellEndMs) ix = 320;
      else ix = 320 + (-90 - 320) * this.ease((el - it.dwellEndMs) / (it.offsetMs - it.dwellEndMs));
      const iy = 190 + Math.sin(el / 300) * 10;
      const sc = 1 + Math.sin(el / 180) * 0.06;
      this.drawKite(ix, iy, 26 * it.salience.sizeMult * sc, (el / 600) * it.salience.rotationMult);
    } else if (el > it.offsetMs) {
      this.fireOnce("intruder_off", "anomaly_offset", { criticalEventKey: "intruder", condition: it.condition });
    }

    if (el >= this.cfg.durationMs) {
      const quality: TrialQuality = {
        avgFps: Math.round(this.frameCount / Math.max(0.001, el / 1000)),
        droppedFrames: this.droppedFrames,
        frameCount: this.frameCount,
        clockDriftMs: Math.round(el - this.cfg.durationMs),
      };
      this.emit("stimulus_offset");
      this.stop();
      this.handlers.onEnd({ actualPassCount: this.actualPassCount, quality });
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
