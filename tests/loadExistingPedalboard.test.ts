import { describe, expect, it } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { LoadExistingPedalboardService } from "../src/services/loadExistingPedalboardService.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import type { ApiCallRecord } from "../src/types/importBundle.js";
import { MockRunner } from "./mockRunner.js";

const bundlePath = "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard";

class MockWriteApi {
  public calls: ApiCallRecord[] = [];

  constructor(private readonly ok = true) {}

  async postForm(
    path: string,
    fields: Record<string, string | number | boolean>,
    purpose: string
  ): Promise<WriteHttpResponse> {
    expect(path).toBe("/pedalboard/load_bundle/");
    expect(fields).toEqual({ bundlepath: bundlePath });
    this.calls.push({
      method: "POST",
      path,
      purpose,
      status: this.ok ? "success" : "failed",
      httpStatus: this.ok ? 200 : 500
    });
    return {
      ok: this.ok,
      status: this.ok ? 200 : 500,
      body: Buffer.from(this.ok ? "true" : "false"),
      text: this.ok ? "true" : "false"
    };
  }
}

describe("LoadExistingPedalboardService", () => {
  it("refuses when write tools are disabled", async () => {
    const service = new LoadExistingPedalboardService(
      new PedalboardService(new MockRunner()),
      null,
      false
    );

    const result = await service.load({ bundlePath, confirm: true });

    expect(result.writeToolsEnabled).toBe(false);
    expect(result.load.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
    expect(result.banksSaveCalled).toBe(false);
    expect(result.pedalboardSaveCalled).toBe(false);
  });

  it("requires explicit confirmation", async () => {
    const api = new MockWriteApi();
    const service = new LoadExistingPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.load({ bundlePath, confirm: false });

    expect(result.confirmed).toBe(false);
    expect(result.load.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
  });

  it("refuses when the bundle path is not listed", async () => {
    const api = new MockWriteApi();
    const service = new LoadExistingPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.load({
      bundlePath: "/root/.pedalboards/Missing.pedalboard",
      confirm: true
    });

    expect(result.targetExistsBefore).toBe(false);
    expect(result.load.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
  });

  it("loads an existing saved pedalboard bundle without save calls", async () => {
    const api = new MockWriteApi(true);
    const service = new LoadExistingPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.load({ bundlePath, confirm: true });

    expect(result.targetExistsBefore).toBe(true);
    expect(result.matchedPedalboard?.title).toBe("AI_TEST_DO_NOT_USE");
    expect(result.load).toEqual({
      attempted: true,
      success: true,
      endpoint: "/pedalboard/load_bundle/"
    });
    expect(result.apiCalls).toHaveLength(1);
    expect(result.apiCalls[0].path).toBe("/pedalboard/load_bundle/");
    expect(result.banksSaveCalled).toBe(false);
    expect(result.pedalboardSaveCalled).toBe(false);
  });

  it("reports API failure without save calls", async () => {
    const api = new MockWriteApi(false);
    const service = new LoadExistingPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.load({ bundlePath, confirm: true });

    expect(result.load.attempted).toBe(true);
    expect(result.load.success).toBe(false);
    expect(result.apiCalls).toHaveLength(1);
    expect(result.apiCalls[0].path).toBe("/pedalboard/load_bundle/");
    expect(result.banksSaveCalled).toBe(false);
    expect(result.pedalboardSaveCalled).toBe(false);
  });
});
