"use client";

const SOUNDS = {
  coin: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
} as const;

function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem("school_sound_enabled") === "true";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem("school_sound_enabled", enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function getSoundEnabled(): boolean {
  return isSoundEnabled();
}

export function playKey(correct: boolean): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(correct ? 440 : 110, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}

export function playCoinSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}
