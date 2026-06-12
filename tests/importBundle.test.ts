import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { DryBundleService } from "../src/services/dryBundleService.js";
import { ImportBundleService } from "../src/services/importBundleService.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { PluginService } from "../src/services/pluginService.js";
import type { ApiCallRecord } from "../src/types/importBundle.js";
import { MockRunner } from "./mockRunner.js";

class MockWriteApi {
  public calls: ApiCallRecord[] = [];

  constructor(
    private readonly options: {
      exportOk?: boolean;
      importOk?: boolean;
    } = {}
  ) {}

  async getBytes(path: string, purpose: string): Promise<WriteHttpResponse> {
    const ok = this.options.exportOk ?? true;
    this.calls.push({
      method: "GET",
      path,
      purpose,
      status: ok ? "success" : "failed",
      httpStatus: ok ? 200 : 404
    });
    return {
      ok,
      status: ok ? 200 : 404,
      body: Buffer.from("backup"),
      text: ok ? "backup" : "missing"
    };
  }

  async postRawFile(path: string, filePath: string, purpose: string): Promise<WriteHttpResponse> {
    await readFile(filePath);
    expect(path).toBe("/pedalboard/load_web/");
    const ok = this.options.importOk ?? true;
    this.calls.push({
      method: "POST",
      path,
      purpose,
      status: ok ? "success" : "failed",
      httpStatus: ok ? 200 : 500
    });
    return {
      ok,
      status: ok ? 200 : 500,
      body: Buffer.from(ok ? "ok" : "fail"),
      text: ok ? "ok" : "fail"
    };
  }
}

async function createBundle() {
  const runner = new MockRunner();
  const pluginService = new PluginService(runner);
  const pedalboardService = new PedalboardService(runner);
  const planner = new PedalboardPlannerService(pluginService, pedalboardService);
  const dryBundleService = new DryBundleService(pluginService);
  const plan = await planner.planFromPrompt({
    style: "clean ambient",
    instrument: "guitar",
    goals: ["wide reverb", "simple gain staging"]
  });
  return { dryBundle: await dryBundleService.createDryBundle(plan), pedalboardService };
}

describe("ImportBundleService", () => {
  it("is disabled unless write tools are enabled", async () => {
    const { dryBundle, pedalboardService } = await createBundle();
    const service = new ImportBundleService(pedalboardService, null, false);

    const result = await service.importDryBundle({ dryBundle, confirm: true });

    expect(result.writeToolsEnabled).toBe(false);
    expect(result.import.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
    expect(result.directFileWrites).toBe(false);
  });

  it("requires explicit confirmation", async () => {
    const { dryBundle, pedalboardService } = await createBundle();
    const api = new MockWriteApi();
    const service = new ImportBundleService(pedalboardService, api as never, true);

    const result = await service.importDryBundle({ dryBundle, confirm: false });

    expect(result.confirmed).toBe(false);
    expect(result.import.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
  });

  it("exports a backup before importing when the target name exists", async () => {
    const { dryBundle, pedalboardService } = await createBundle();
    const api = new MockWriteApi({ exportOk: true, importOk: true });
    const service = new ImportBundleService(pedalboardService, api as never, true);

    const result = await service.importDryBundle({ dryBundle, confirm: true, targetName: "Dave" });

    expect(result.targetExists).toBe(true);
    expect(result.backup.required).toBe(true);
    expect(result.backup.created).toBe(true);
    expect(result.import.success).toBe(true);
    expect(result.apiCalls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(result.apiCalls[0].path).toContain("/pedalboard/pack_bundle/?bundlepath=");
    expect(result.apiCalls[1].path).toBe("/pedalboard/load_web/");
    expect(result.directFileWrites).toBe(false);
  });

  it("aborts import when required backup export fails", async () => {
    const { dryBundle, pedalboardService } = await createBundle();
    const api = new MockWriteApi({ exportOk: false, importOk: true });
    const service = new ImportBundleService(pedalboardService, api as never, true);

    const result = await service.importDryBundle({ dryBundle, confirm: true, targetName: "Dave" });

    expect(result.targetExists).toBe(true);
    expect(result.backup.required).toBe(true);
    expect(result.backup.created).toBe(false);
    expect(result.import.attempted).toBe(false);
    expect(result.apiCalls.every((call) => call.method === "GET")).toBe(true);
    expect(result.directFileWrites).toBe(false);
  });

  it("does not fallback to direct file writes when API import fails", async () => {
    const { dryBundle, pedalboardService } = await createBundle();
    const api = new MockWriteApi({ importOk: false });
    const service = new ImportBundleService(pedalboardService, api as never, true);

    const result = await service.importDryBundle({ dryBundle, confirm: true });

    expect(result.import.attempted).toBe(true);
    expect(result.import.success).toBe(false);
    expect(result.directFileWrites).toBe(false);
    expect(result.apiCalls.every((call) => call.method === "POST")).toBe(true);
    expect(result.apiCalls.every((call) => call.path === "/pedalboard/load_web/")).toBe(true);
  });
});
