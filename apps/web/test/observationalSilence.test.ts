import { describe, expect, it } from "vitest";
import {
  BASELINE_SALIENCE,
  configForCondition,
  DEFAULT_STIMULUS_CONFIG,
  INTRUDER_CONDITIONS,
} from "../lib/research/observationalSilenceStimulus";

describe("ObservationalSilenceStimulus Configuration", () => {
  it("has predefined intruder condition palette mapping", () => {
    expect(INTRUDER_CONDITIONS.magenta.fill).toBe("#D4537E");
    expect(INTRUDER_CONDITIONS.teal_matched.fill).toBe("#1D9E75");
    expect(INTRUDER_CONDITIONS.amber_matched.fill).toBe("#EF9F27");
  });

  it("builds identical timing configuration across conditions", () => {
    const magentaConfig = configForCondition("magenta");
    const tealConfig = configForCondition("teal_matched");
    const amberConfig = configForCondition("amber_matched");

    expect(magentaConfig.durationMs).toBe(22000);
    expect(tealConfig.durationMs).toBe(22000);
    expect(amberConfig.durationMs).toBe(22000);

    expect(magentaConfig.intruder.onsetMs).toBe(DEFAULT_STIMULUS_CONFIG.intruder.onsetMs);
    expect(tealConfig.intruder.onsetMs).toBe(DEFAULT_STIMULUS_CONFIG.intruder.onsetMs);
    expect(amberConfig.intruder.onsetMs).toBe(DEFAULT_STIMULUS_CONFIG.intruder.onsetMs);
  });

  it("applies condition-specific intruder fills correctly", () => {
    const tealConfig = configForCondition("teal_matched");
    expect(tealConfig.intruder.fill).toBe(INTRUDER_CONDITIONS.teal_matched.fill);
    expect(tealConfig.intruder.accent).toBe(INTRUDER_CONDITIONS.teal_matched.accent);
    expect(tealConfig.intruder.condition).toBe("teal_matched");
  });

  it("uses baseline salience by default", () => {
    expect(BASELINE_SALIENCE.sizeMult).toBe(1);
    expect(BASELINE_SALIENCE.rotationMult).toBe(1);
    expect(BASELINE_SALIENCE.opacity).toBe(0.92);
  });
});
