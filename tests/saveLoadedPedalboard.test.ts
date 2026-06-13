import { describe, expect, it } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { SaveLoadedPedalboardService } from "../src/services/saveLoadedPedalboardService.js";
import type { ApiCallRecord } from "../src/types/importBundle.js";
import { MockRunner } from "./mockRunner.js";

class MockWriteApi {
  public calls: ApiCallRecord[] = [];

  constructor(
    private readonly ok = true,
    private readonly onPost?: () => void,
    private readonly loadedPluginUris: string[] = ["http://moddevices.com/plugins/mod-devel/Gain"]
  ) {}

  async getJson<T>(
    path: string,
    purpose: string
  ): Promise<{ ok: boolean; status: number; value: T; text: string }> {
    expect(path).toContain("/pedalboard/info/?bundlepath=");
    this.calls.push({ method: "GET", path, purpose, status: "success", httpStatus: 200 });
    const value = { plugins: this.loadedPluginUris.map((uri) => ({ uri })) } as T;
    return { ok: true, status: 200, value, text: JSON.stringify(value) };
  }

  async postForm(
    path: string,
    fields: Record<string, string | number | boolean>,
    purpose: string
  ): Promise<WriteHttpResponse> {
    expect(path).toBe("/pedalboard/save");
    expect(fields).toEqual({ title: "New Safe Board", asNew: 1 });
    this.onPost?.();
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

class SaveAwareRunner extends MockRunner {
  public saved = false;

  async exec(command: string) {
    const result = await super.exec(command);
    if (this.saved && command.includes("/root/.pedalboards") && command.startsWith("find ")) {
      return {
        ...result,
        stdout: `${result.stdout.trim()}\n/root/.pedalboards/New_Safe_Board.pedalboard\n/root/.pedalboards/New_Safe_Board.pedalboard/manifest.ttl\n`
      };
    }
    return result;
  }
}

describe("SaveLoadedPedalboardService", () => {
  it("refuses when write tools are disabled", async () => {
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(new MockRunner()),
      null,
      false
    );

    const result = await service.saveAsNew({ title: "New Safe Board", confirm: true });

    expect(result.writeToolsEnabled).toBe(false);
    expect(result.saved.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
    expect(result.banksSaveCalled).toBe(false);
  });

  it("requires confirm=true", async () => {
    const api = new MockWriteApi();
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.saveAsNew({ title: "New Safe Board", confirm: false });

    expect(result.confirmed).toBe(false);
    expect(result.saved.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
  });

  it("refuses when the title already exists", async () => {
    const api = new MockWriteApi();
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.saveAsNew({ title: "Dave", confirm: true });

    expect(result.targetExistsBefore).toBe(true);
    expect(result.saved.attempted).toBe(false);
    expect(result.apiCalls).toEqual([]);
  });

  it("refuses to save when loaded graph plugin URIs do not match the dry bundle", async () => {
    const api = new MockWriteApi(true, undefined, ["http://unexpected/plugin"]);
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.saveAsNew({
      title: "New Safe Board",
      confirm: true,
      loadedBundlePath: "/tmp/pedalboards/New_Safe_Board.pedalboard",
      expectedPluginUris: ["http://moddevices.com/plugins/mod-devel/Gain"]
    });

    expect(result.saved.attempted).toBe(false);
    expect(result.loadedGraphValidation?.success).toBe(false);
    expect(result.apiCalls.map((call) => call.method)).toEqual(["GET"]);
    expect(result.banksSaveCalled).toBe(false);
  });

  it("saves the currently loaded pedalboard as a new user pedalboard", async () => {
    const runner = new SaveAwareRunner();
    const api = new MockWriteApi(true, () => {
      runner.saved = true;
    });
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(runner),
      api as never,
      true
    );

    const result = await service.saveAsNew({ title: "New Safe Board", confirm: true });

    expect(result.saved).toEqual({ attempted: true, success: true, endpoint: "/pedalboard/save" });
    expect(result.appearsAfterSave).toBe(true);
    expect(result.matchingPedalboards[0].title).toBe("New Safe Board");
    expect(result.apiCalls).toHaveLength(1);
    expect(result.apiCalls[0].path).toBe("/pedalboard/save");
    expect(result.banksSaveCalled).toBe(false);
  });

  it("reports API failure without calling banks/save", async () => {
    const api = new MockWriteApi(false);
    const service = new SaveLoadedPedalboardService(
      new PedalboardService(new MockRunner()),
      api as never,
      true
    );

    const result = await service.saveAsNew({ title: "New Safe Board", confirm: true });

    expect(result.saved.attempted).toBe(true);
    expect(result.saved.success).toBe(false);
    expect(result.appearsAfterSave).toBe(false);
    expect(result.apiCalls).toHaveLength(1);
    expect(result.apiCalls[0].path).toBe("/pedalboard/save");
    expect(result.banksSaveCalled).toBe(false);
  });
});
