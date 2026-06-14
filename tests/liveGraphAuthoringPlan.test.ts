import { describe, expect, it } from "vitest";
import { LiveGraphAuthoringPlanService } from "../src/services/liveGraphAuthoringPlan.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
import { PluginService } from "../src/services/pluginService.js";
import { MockRunner } from "./mockRunner.js";
import type { PedalboardPlan } from "../src/types/plan.js";

function manualPlan(overrides: Partial<PedalboardPlan> = {}): PedalboardPlan {
  return {
    dryRun: true,
    safety: {
      writesFiles: false,
      modifiesDevice: false,
      callsPostEndpoints: false
    },
    request: {
      style: "clean ambient",
      instrument: "guitar",
      goals: ["wide reverb", "simple gain staging"],
      referenceArtists: ["Brian Eno"]
    },
    template: null,
    availablePluginCount: 2,
    signalChain: [
      {
        role: "input gain",
        name: "Gain",
        uri: "http://moddevices.com/plugins/mod-devel/Gain",
        reason: "Input trim",
        suggestedInstance: "gain_1",
        parameterRanges: {
          Gain: { min: -12, max: 6, unit: "dB" }
        }
      },
      {
        role: "reverb",
        name: "MVerb",
        uri: "http://distrho.sf.net/plugins/MVerb",
        reason: "Space",
        suggestedInstance: "mverb_2",
        parameterRanges: {
          mix: { min: 0.2, max: 0.4 },
          decay: { min: 1.5, max: 3.5, unit: "s" }
        }
      }
    ],
    snapshots: [
      {
        name: "Base",
        description: "Balanced",
        parameterFocus: {
          gain: "moderate"
        }
      }
    ],
    notes: [],
    unsupportedIdeas: [],
    ...overrides
  };
}

describe("LiveGraphAuthoringPlanService", () => {
  it("builds a read-only live API call plan in the correct order", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const plan = await service.buildPlan(manualPlan());

    expect(plan.validation.valid).toBe(true);
    expect(plan.apiCalls.map((call) => call.path)).toEqual([
      "/effect/add//graph/gain_1?x=100&y=180&uri=http%3A//moddevices.com/plugins/mod-devel/Gain",
      "/effect/add//graph/mverb_2?x=320&y=300&uri=http%3A//distrho.sf.net/plugins/MVerb",
      "/effect/connect/capture_1,gain_1/In",
      "/effect/connect/gain_1/Out,mverb_2/in1",
      "/effect/connect/gain_1/Out,mverb_2/in2",
      "/effect/connect/mverb_2/out1,playback_1",
      "/effect/connect/mverb_2/out2,playback_2",
      "/effect/parameter/set/",
      "/effect/parameter/set/",
      "/effect/parameter/set/",
      "/snapshot/save",
      "/pedalboard/save"
    ]);

    expect(plan.apiCalls[0].method).toBe("GET");
    expect(plan.apiCalls[2].method).toBe("GET");
    expect(plan.apiCalls[7].method).toBe("POST");
    expect(plan.apiCalls[10].path).toBe("/snapshot/save");
    expect(plan.apiCalls[11].body).toEqual({
      kind: "form",
      fields: {
        title: "guitar clean ambient",
        asNew: 1
      }
    });

    const gainSet = plan.apiCalls[7];
    expect(gainSet.body).toEqual({
      kind: "json",
      value: "/graph/gain_1/Gain/-6"
    });
    const mixSet = plan.apiCalls[8];
    expect(mixSet.body).toEqual({
      kind: "json",
      value: "/graph/mverb_2/mix/0.35"
    });
    const decaySet = plan.apiCalls[9];
    expect(decaySet.body).toEqual({
      kind: "json",
      value: "/graph/mverb_2/decay/2.5"
    });
  });

  it("omits snapshot/save when no snapshots are requested", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const plan = await service.buildPlan(manualPlan({ snapshots: [] }));

    expect(plan.validation.valid).toBe(true);
    expect(plan.apiCalls.some((call) => call.path === "/snapshot/save")).toBe(false);
    expect(plan.apiCalls.at(-1)?.path).toBe("/pedalboard/save");
  });

  it("reports invalid plans when a parameter has no matching port", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const invalid = manualPlan({
      signalChain: [
        {
          role: "input gain",
          name: "Gain",
          uri: "http://moddevices.com/plugins/mod-devel/Gain",
          reason: "Input trim",
          suggestedInstance: "gain_1",
          parameterRanges: {
            NotAPort: { min: -12, max: 6 }
          }
        }
      ]
    });

    const plan = await service.buildPlan(invalid);

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.parameters.errors[0]).toContain("NotAPort");
    expect(plan.apiCalls).toEqual([]);
  });

  it("matches the planner's installed-plugin output", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const planner = new PedalboardPlannerService(pluginService);

    const planned = await planner.planFromPrompt({
      style: "clean ambient",
      instrument: "guitar",
      goals: ["wide reverb", "simple gain staging"],
      referenceArtists: ["Brian Eno"]
    });

    const service = new LiveGraphAuthoringPlanService(pluginService);
    const plan = await service.buildPlan(planned);

    expect(plan.validation.valid).toBe(true);
    expect(plan.apiCalls[0].path).toContain("/effect/add/");
    expect(plan.apiCalls.at(-1)?.path).toBe("/pedalboard/save");
  });
});
