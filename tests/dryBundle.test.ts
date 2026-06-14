import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DryBundleService } from "../src/services/dryBundleService.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { PluginService } from "../src/services/pluginService.js";
import { createPedalboardDryBundleTool } from "../src/tools/createPedalboardDryBundle.js";
import { MockRunner } from "./mockRunner.js";

describe("DryBundleService", () => {
  it("generates a complete local dry-run pedalboard bundle", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
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
    expect(mainTtl).toContain("/in1>");
    expect(mainTtl).toContain("/out1>");
    expect(mainTtl).not.toContain("MVerb_3/In");
    expect(mainTtl).not.toContain("MVerb_3/Out");
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
});
