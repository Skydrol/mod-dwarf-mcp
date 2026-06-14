import { describe, expect, it } from "vitest";
import { PedalboardSafetyService } from "../src/services/pedalboardSafetyService.js";
import type { PedalboardPlan } from "../src/types/plan.js";

function unsafePlan(): PedalboardPlan {
  return {
    dryRun: true,
    safety: {
      writesFiles: false,
      modifiesDevice: false,
      callsPostEndpoints: false
    },
    request: {
      style: "infinite shoegaze",
      instrument: "guitar",
      goals: ["maximum feedback", "loudest possible", "self-oscillating delay wall"]
    },
    template: null,
    availablePluginCount: 3,
    signalChain: [
      {
        role: "delay",
        name: "Bollie Delay",
        uri: "https://ca9.eu/lv2/bolliedelay",
        reason: "Delay",
        suggestedInstance: "delay_1",
        parameterRanges: {
          feedback: { min: 0, max: 100, unit: "%" },
          mix: { min: 0, max: 100, unit: "%" }
        }
      },
      {
        role: "reverb",
        name: "MVerb",
        uri: "http://distrho.sf.net/plugins/MVerb",
        reason: "Reverb",
        suggestedInstance: "reverb_2",
        parameterRanges: {
          mix: { min: 0, max: 100, unit: "%" },
          decay: { min: 0, max: 10, unit: "s" }
        }
      },
      {
        role: "output level",
        name: "Gain 2x2",
        uri: "http://moddevices.com/plugins/mod-devel/Gain2x2",
        reason: "Output trim",
        suggestedInstance: "output_3",
        parameterRanges: {
          Gain: { min: -12, max: 6, unit: "dB" }
        }
      }
    ],
    snapshots: [],
    notes: [],
    unsupportedIdeas: []
  };
}

describe("PedalboardSafetyService", () => {
  it("clamps unsafe output gain, feedback, and reverb settings", () => {
    const service = new PedalboardSafetyService();
    const result = service.adjustPlan(unsafePlan());

    expect(result.warnings.join("\n")).toContain("unsafe feedback or loudness");
    expect(result.adjustments.length).toBeGreaterThanOrEqual(4);

    const delay = result.adjustedPlan.signalChain[0];
    const reverb = result.adjustedPlan.signalChain[1];
    const output = result.adjustedPlan.signalChain[2];

    expect(delay.parameterRanges.feedback.max).toBeLessThanOrEqual(45);
    expect(reverb.parameterRanges.mix.max).toBeLessThanOrEqual(35);
    expect(reverb.parameterRanges.decay.max).toBeLessThanOrEqual(6);
    expect(output.parameterRanges.Gain.max).toBeLessThanOrEqual(0);
  });
});
