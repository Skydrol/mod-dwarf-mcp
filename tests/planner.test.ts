import { describe, expect, it } from "vitest";
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
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const planner = new PedalboardPlannerService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "psychedelic pop",
      instrument: "guitar",
      goals: ["Let It Happen", "Tame Impala vibe", "song snapshots"],
      referenceArtists: ["Tame Impala"]
    });

    expect(plan.signalChain.map((plugin) => plugin.role)).toEqual(
      expect.arrayContaining(["input gain", "core tone", "reverb", "output level"])
    );
    expect(plan.signalChain.map((plugin) => plugin.role)).not.toContain("Base");
    expect(plan.snapshots.map((snapshot) => snapshot.name)).toEqual([
      "Intro Drift",
      "Verse Pulse",
      "Chorus Bloom",
      "Bridge Collapse",
      "Lead Lift"
    ]);
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
