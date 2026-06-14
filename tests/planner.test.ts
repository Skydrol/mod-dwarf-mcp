import { describe, expect, it } from "vitest";
import { pluginCatalog } from "../src/data/pluginCatalog.js";
import { LiveGraphAuthoringPlanService } from "../src/services/liveGraphAuthoringPlan.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
import { PluginService } from "../src/services/pluginService.js";
import { planPedalboardFromPromptTool } from "../src/tools/planPedalboardFromPrompt.js";
import { MockRunner } from "./mockRunner.js";

describe("PedalboardPlannerService", () => {
  it("returns a dry-run plan using only installed plugins", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const planner = new PedalboardPlannerService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "clean ambient",
      instrument: "guitar",
      goals: ["wide reverb", "simple gain staging"],
      referenceArtists: ["Brian Eno"]
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.safety).toEqual({
      writesFiles: false,
      modifiesDevice: false,
      callsPostEndpoints: false
    });
    expect(plan.availablePluginCount).toBe(2);
    expect(plan.template).toBeNull();
    expect(plan.signalChain.length).toBeGreaterThan(0);

    const installedNames = new Set(
      (await pluginService.listPlugins("names")).plugins.map((plugin) => plugin.name)
    );
    for (const plugin of plan.signalChain) {
      expect(installedNames.has(plugin.name)).toBe(true);
    }
  });

  it("special-cases Tame Impala Let It Happen snapshots", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "psychedelic pop",
      instrument: "guitar",
      goals: ["Let It Happen", "Tame Impala vibe", "song snapshots"],
      referenceArtists: ["Tame Impala"]
    });

    const roles = plan.signalChain.map((plugin) => plugin.role);
    expect(roles.filter((role) => role === "input gain")).toHaveLength(1);
    expect(roles).toEqual(
      expect.arrayContaining(["input gain", "modulation", "delay", "reverb", "output level"])
    );
    expect(roles).not.toContain("core tone");
    expect(plan.snapshots.map((snapshot) => snapshot.name)).toEqual([
      "Intro Drift",
      "Verse Pulse",
      "Chorus Bloom",
      "Bridge Collapse",
      "Lead Lift"
    ]);
  });

  it("builds a valid high-gain board without generic cab guesses", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);
    const live = new LiveGraphAuthoringPlanService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "doom metal",
      instrument: "guitar",
      goals: ["Make the loudest possible doom metal tone", "huge output volume"]
    });
    const livePlan = await live.buildPlan(plan);

    expect(plan.signalChain.map((plugin) => plugin.role)).toEqual(
      expect.arrayContaining(["input gain", "high gain drive", "cabinet", "output level"])
    );
    expect(plan.notes.join("\n")).toContain("loudest possible");
    expect(livePlan.validation.valid).toBe(true);
    expect(livePlan.validation.errors).toEqual([]);
  });

  it("keeps noisy self-oscillating delay requests on a safe feedback profile", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);
    const live = new LiveGraphAuthoringPlanService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "experimental",
      instrument: "guitar",
      goals: ["Make a noisy self-oscillating delay patch"]
    });
    const livePlan = await live.buildPlan(plan);

    expect(plan.signalChain.map((plugin) => plugin.role)).toContain("feedback-capable delay");
    expect(plan.notes.join("\n")).toContain("interpreted safely");
    expect(livePlan.validation.valid).toBe(true);
    expect(livePlan.validation.errors).toEqual([]);
  });

  it("avoids duplicate TinyGain Mono stages on a clean funk prompt", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "clean funk",
      instrument: "guitar",
      goals: ["clean funk tone", "massive output volume"]
    });

    const tinyGainCount = plan.signalChain.filter((plugin) => plugin.name === "TinyGain Mono").length;
    expect(tinyGainCount).toBeLessThanOrEqual(1);
    expect(plan.signalChain.map((plugin) => plugin.role)).toEqual(
      expect.arrayContaining(["input gain", "output level"])
    );
  });

  it("exposes the planner through the MCP tool adapter", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const pedalboardService = new PedalboardService(runner);
    const planner = new PedalboardPlannerService(pluginService);

    const response = await planPedalboardFromPromptTool(
      {
        style: "ambient",
        instrument: "guitar",
        goals: ["long reverb"]
      },
      {
        deviceService: undefined as never,
        pluginService,
        pedalboardService,
        bankService: undefined as never,
        snapshotService: undefined as never,
        pedalboardPlannerService: planner
      }
    );

    const plan = JSON.parse(response.content[0].text) as {
      dryRun: boolean;
      safety: { callsPostEndpoints: boolean };
    };
    expect(plan.dryRun).toBe(true);
    expect(plan.safety.callsPostEndpoints).toBe(false);
  });
});
