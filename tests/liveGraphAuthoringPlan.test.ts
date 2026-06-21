import { describe, expect, it } from "vitest";
import type { PluginCatalogEntry } from "../src/data/pluginCatalog.js";
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

function audioIn(index: number, symbol: string, name: string): PluginCatalogEntry["ports"][number] {
  return {
    index,
    symbol,
    name,
    types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
    kind: "audio",
    direction: "input",
    properties: []
  };
}

function audioOut(
  index: number,
  symbol: string,
  name: string
): PluginCatalogEntry["ports"][number] {
  return {
    index,
    symbol,
    name,
    types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#OutputPort"],
    kind: "audio",
    direction: "output",
    properties: []
  };
}

function control(
  index: number,
  symbol: string,
  name: string,
  minimum: number,
  maximum: number,
  unit?: string
): PluginCatalogEntry["ports"][number] {
  return {
    index,
    symbol,
    name,
    types: ["http://lv2plug.in/ns/lv2core#ControlPort", "http://lv2plug.in/ns/lv2core#InputPort"],
    kind: "control",
    direction: "input",
    minimum,
    maximum,
    default: minimum + (maximum - minimum) / 2,
    unit,
    properties: []
  };
}

function bollieDelayEntry(): PluginCatalogEntry {
  return {
    uri: "https://ca9.eu/lv2/bolliedelay",
    name: "Bollie Delay",
    ports: [
      audioIn(0, "InputL", "Input L"),
      audioIn(1, "InputR", "Input R"),
      audioOut(2, "OutputL", "Output L"),
      audioOut(3, "OutputR", "Output R"),
      control(4, "feedback", "Feedback", 0, 100, "%"),
      control(5, "mix", "Mix", 0, 100, "%")
    ]
  };
}

function neuralAmpModelerEntry(): PluginCatalogEntry {
  return {
    uri: "urn:example:neural-amp-modeler",
    name: "Neural Amp Modeler",
    ports: [
      audioIn(0, "IN", "IN"),
      audioOut(1, "OUT", "OUT"),
      control(2, "PREGAIN", "PREGAIN", -12, 12, "dB")
    ]
  };
}

function zamCompEntry(): PluginCatalogEntry {
  return {
    uri: "urn:example:zamcomp",
    name: "ZamComp",
    ports: [
      audioIn(0, "in", "In"),
      audioOut(1, "out", "Out"),
      control(2, "attack", "Attack", 0.001, 0.2, "s"),
      control(3, "release", "Release", 0.01, 1.0, "s")
    ]
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
      "/effect/add//graph/gain_1?x=120&y=260&uri=http%3A//moddevices.com/plugins/mod-devel/Gain",
      "/effect/add//graph/mverb_2?x=940&y=500&uri=http%3A//distrho.sf.net/plugins/MVerb",
      "/effect/connect/capture_1,gain_1/In",
      "/effect/connect/gain_1/Out,mverb_2/in1",
      "/effect/connect/gain_1/Out,mverb_2/in2",
      "/effect/connect/mverb_2/out1,playback_1",
      "/effect/connect/mverb_2/out2,playback_2",
      "/effect/parameter/set/",
      "/effect/parameter/set/",
      "/effect/parameter/set/",
      "/pedalboard/save"
    ]);

    expect(plan.apiCalls[0].method).toBe("GET");
    expect(plan.apiCalls[2].method).toBe("GET");
    expect(plan.apiCalls[7].method).toBe("POST");
    expect(plan.apiCalls[10].body).toEqual({
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

    // postSaveApiCalls is always empty; the executor builds them after save with the actual title
    expect(plan.postSaveApiCalls).toEqual([]);

    // buildPostSaveSnapshotCalls produces the correct calls when given the actual saved title
    const postSaveCalls = service.buildPostSaveSnapshotCalls(
      plan.plugins,
      plan.sourcePlan.snapshots,
      "guitar clean ambient"
    );
    expect(postSaveCalls.map((c) => c.path)).toEqual(["/snapshot/save", "/pedalboard/save"]);
    expect(postSaveCalls[0].body).toEqual({ kind: "form", fields: { id: 0, name: "Base" } });
    expect(postSaveCalls[1].body).toEqual({
      kind: "form",
      fields: { title: "guitar clean ambient", asNew: 0 }
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
    expect(plan.postSaveApiCalls).toEqual([]);
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

  it("rejects unsupported Bollie Delay time mapping", async () => {
    const pluginService = new PluginService(null, [bollieDelayEntry()]);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const invalid = manualPlan({
      signalChain: [
        {
          role: "delay",
          name: "Bollie Delay",
          uri: "https://ca9.eu/lv2/bolliedelay",
          reason: "Rhythmic delay",
          suggestedInstance: "delay_1",
          parameterRanges: {
            time: { min: 250, max: 650, unit: "ms" }
          }
        }
      ]
    });

    const plan = await service.buildPlan(invalid);

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.parameters.errors.join("\n")).toContain("time");
    expect(plan.apiCalls).toEqual([]);
  });

  it("does not guess missing Neural Amp Modeler tone controls", async () => {
    const pluginService = new PluginService(null, [neuralAmpModelerEntry()]);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const invalid = manualPlan({
      signalChain: [
        {
          role: "high gain drive",
          name: "Neural Amp Modeler",
          uri: "urn:example:neural-amp-modeler",
          reason: "Amp model",
          suggestedInstance: "nam_1",
          parameterRanges: {
            PREGAIN: { min: -12, max: 12, unit: "dB" },
            MASTER: { min: -6, max: 3, unit: "dB" },
            BASS: { min: -8, max: 8, unit: "dB" },
            MID: { min: -8, max: 8, unit: "dB" },
            TREBLE: { min: -8, max: 8, unit: "dB" }
          }
        }
      ]
    });

    const plan = await service.buildPlan(invalid);

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.parameters.errors.join("\n")).toContain("MASTER");
    expect(plan.validation.parameters.errors.join("\n")).toContain("BASS");
    expect(plan.validation.parameters.errors.join("\n")).toContain("MID");
    expect(plan.validation.parameters.errors.join("\n")).toContain("TREBLE");
    expect(plan.apiCalls).toEqual([]);
  });

  it("keeps ZamComp attack and release inside real device ranges", async () => {
    const pluginService = new PluginService(null, [zamCompEntry()], null);
    const service = new LiveGraphAuthoringPlanService(pluginService);

    const valid = manualPlan({
      signalChain: [
        {
          role: "dynamics",
          name: "ZamComp",
          uri: "urn:example:zamcomp",
          reason: "Compression",
          suggestedInstance: "zamcomp_1",
          parameterRanges: {
            attack: { min: 0.001, max: 0.03, unit: "s" },
            release: { min: 0.05, max: 0.4, unit: "s" }
          }
        }
      ]
    });

    const plan = await service.buildPlan(valid);

    expect(plan.validation.valid).toBe(true);
    const plugin = plan.plugins[0];
    expect(plugin.parameterPlans).toHaveLength(2);
    for (const parameter of plugin.parameterPlans) {
      expect(parameter.value).toBeGreaterThanOrEqual(parameter.minimum);
      expect(parameter.value).toBeLessThanOrEqual(parameter.maximum);
    }
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
