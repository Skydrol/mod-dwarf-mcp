import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { pluginCatalog } from "../src/data/pluginCatalog.js";
import { DryBundleService } from "../src/services/dryBundleService.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { PluginService } from "../src/services/pluginService.js";
import { createPedalboardDryBundleTool } from "../src/tools/createPedalboardDryBundle.js";
import { MockRunner } from "./mockRunner.js";

describe("DryBundleService", () => {
  it("generates a complete local dry-run pedalboard bundle", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);
    const service = new DryBundleService(pluginService);
    const plan = await planner.planFromPrompt({
      style: "clean ambient",
      instrument: "guitar",
      goals: ["wide reverb", "simple gain staging"]
    });

    const bundle = await service.createDryBundle(plan);

    expect(bundle.dryRun).toBe(true);
    expect(bundle.validation.pluginUris.valid).toBe(true);
    expect(bundle.validation.snapshots.valid).toBe(true);
    expect(bundle.validation.ttl.valid).toBe(true);
    expect(bundle.validation.dryRun).toEqual({
      localOnly: true,
      uploadedToDevice: false,
      calledModApi: false,
      modifiedPedalboards: false
    });
    expect(bundle.sourcePlan.signalChain.length).toBeGreaterThan(0);

    await Promise.all(Object.values(bundle.generatedFiles).map((file) => access(file)));

    const manifest = await readFile(bundle.generatedFiles.manifest, "utf8");
    const mainTtl = await readFile(bundle.generatedFiles.mainTtl, "utf8");
    const snapshots = JSON.parse(await readFile(bundle.generatedFiles.snapshots, "utf8")) as {
      snapshots: unknown[];
    };
    const addressings = JSON.parse(
      await readFile(bundle.generatedFiles.addressings, "utf8")
    ) as Record<string, unknown>;

    expect(manifest).toContain("pedal:Pedalboard");
    expect(mainTtl).toContain("a ingen:Block");
    expect(mainTtl).toContain("ingen:canvasX 120.0 ;");
    expect(mainTtl).toContain("ingen:canvasX 880.0 ;");
    expect(mainTtl).toContain("ingen:canvasX 1640.0 ;");
    expect(mainTtl).toContain("ingen:canvasY 760.0 ;");
    expect(snapshots.snapshots.length).toBe(plan.snapshots.length);
    expect(Object.keys(addressings)[0]).toBe("/hmi/knob1");
  });

  it("reports plugins without URIs as invalid", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const planner = new PedalboardPlannerService(pluginService);
    const service = new DryBundleService(pluginService);
    const plan = await planner.planFromPrompt({
      style: "clean ambient",
      instrument: "guitar",
      goals: ["wide reverb"]
    });
    const planWithMissingUri = {
      ...plan,
      signalChain: [{ ...plan.signalChain[0], uri: undefined }, ...plan.signalChain.slice(1)]
    };

    await expect(service.createDryBundle(planWithMissingUri)).rejects.toThrow(
      "Safety check failed"
    );
  });

  it("exposes the local dry-bundle generator through the MCP tool adapter", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const pedalboardService = new PedalboardService(runner);
    const planner = new PedalboardPlannerService(pluginService);
    const plan = await planner.planFromPrompt({
      style: "ambient",
      instrument: "guitar",
      goals: ["long reverb"]
    });

    const response = await createPedalboardDryBundleTool(
      { plan },
      {
        deviceService: undefined as never,
        pluginService,
        pedalboardService,
        bankService: undefined as never,
        snapshotService: undefined as never,
        pedalboardPlannerService: planner,
        dryBundleService: new DryBundleService(pluginService)
      }
    );

    const bundle = JSON.parse(response.content[0].text) as {
      dryRun: boolean;
      generatedFiles: Record<string, string>;
      validation: { pluginUris: { valid: boolean }; dryRun: { uploadedToDevice: boolean } };
    };
    expect(bundle.dryRun).toBe(true);
    expect(Object.keys(bundle.generatedFiles).sort()).toEqual([
      "addressings",
      "mainTtl",
      "manifest",
      "snapshots"
    ]);
    expect(bundle.validation.pluginUris.valid).toBe(true);
    expect(bundle.validation.dryRun.uploadedToDevice).toBe(false);
  });

  it("keeps snapshot output gain controlled for a Let It Happen style board", async () => {
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);
    const service = new DryBundleService(pluginService);

    const plan = await planner.planFromPrompt({
      style: "psychedelic pop",
      instrument: "guitar",
      goals: ["Let It Happen", "huge stereo movement", "psychedelic chorus", "wide reverb"],
      referenceArtists: ["Tame Impala"]
    });

    const bundle = await service.createDryBundle(plan);
    const snapshots = JSON.parse(await readFile(bundle.generatedFiles.snapshots, "utf8")) as {
      snapshots: Array<{
        data: Record<string, { ports: Record<string, number> }>;
      }>;
    };
    const outputPlugin = bundle.sourcePlan.signalChain.at(-1);

    expect(outputPlugin?.role).toBe("output level");
    expect(outputPlugin?.suggestedInstance).toBeDefined();

    const values = snapshots.snapshots.map((snapshot) => {
      const ports = snapshot.data[outputPlugin!.suggestedInstance].ports;
      return Object.values(ports).find((value): value is number => typeof value === "number") ?? 0;
    });

    expect(Math.max(...values)).toBeLessThanOrEqual(0);
    for (let index = 1; index < values.length; index += 1) {
      expect(Math.abs(values[index] - values[index - 1])).toBeLessThanOrEqual(3);
    }
  });
});
