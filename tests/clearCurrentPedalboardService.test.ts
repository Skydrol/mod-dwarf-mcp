import { describe, expect, it, vi } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { ClearCurrentPedalboardService } from "../src/services/clearCurrentPedalboardService.js";
import { clearCurrentPedalboardTool } from "../src/tools/clearCurrentPedalboard.js";
import type { ApiCallRecord } from "../src/types/importBundle.js";

class MockWriteApi {
  public calls: Array<{ method: string; path: string; body?: unknown }> = [];

  constructor(
    private readonly beforePlugins: Array<{ instance: string; uri: string }>,
    private readonly afterPlugins: Array<{ instance: string; uri: string }> = []
  ) {}

  async getJson<T>(
    path: string,
    purpose: string
  ): Promise<{ ok: boolean; status: number; value: T | null; text: string }> {
    this.calls.push({ method: "GET", path, body: purpose });
    const value = {
      plugins:
        this.calls.filter((call) => call.path === "/pedalboard/info/").length === 1
          ? this.beforePlugins
          : this.afterPlugins
    } as T;
    return { ok: true, status: 200, value, text: JSON.stringify(value) };
  }

  async getBytes(path: string, purpose: string): Promise<WriteHttpResponse> {
    this.calls.push({ method: "GET", path, body: purpose });
    expect(path.startsWith("/effect/remove//graph/")).toBe(true);
    expect(path.includes("/effect/disconnect/")).toBe(false);
    return {
      ok: true,
      status: 200,
      body: Buffer.from("true"),
      text: "true"
    };
  }
}

describe("ClearCurrentPedalboardService", () => {
  it("removes every discovered plugin instance without calling disconnect", async () => {
    const writeApi = new MockWriteApi(
      [
        { instance: "distortion_2", uri: "http://moddevices.com/plugins/mod-devel/DS1" },
        { instance: "reverb_5", uri: "http://moddevices.com/plugins/tap/reverb" }
      ],
      []
    );
    const service = new ClearCurrentPedalboardService(writeApi as never, true);

    const result = await service.clear({ confirm: true });

    expect(result.success).toBe(true);
    expect(result.removedInstances).toEqual(["distortion_2", "reverb_5"]);
    expect(result.removeCalls.map((call) => call.path)).toEqual([
      "/effect/remove//graph/distortion_2",
      "/effect/remove//graph/reverb_5"
    ]);
    expect(result.before.pluginCount).toBe(2);
    expect(result.after.pluginCount).toBe(0);
    expect(writeApi.calls.map((call) => call.path)).toEqual([
      "/pedalboard/info/",
      "/effect/remove//graph/distortion_2",
      "/effect/remove//graph/reverb_5",
      "/pedalboard/info/"
    ]);
    expect(writeApi.calls.some((call) => String(call.path).includes("/effect/disconnect/"))).toBe(
      false
    );
  });

  it("treats a 400 Bad Request active-graph response as an already empty board", async () => {
    const writeApi = {
      calls: [] as Array<{ method: string; path: string; body?: unknown }>,
      async getJson<T>(path: string, purpose: string) {
        this.calls.push({ method: "GET", path, body: purpose });
        return {
          ok: false,
          status: 400,
          value: null,
          text: "<html><title>400: Bad Request</title><body>400: Bad Request</body></html>"
        } as { ok: boolean; status: number; value: T | null; text: string };
      },
      async getBytes(): Promise<WriteHttpResponse> {
        throw new Error("should not be called for an empty board");
      }
    };
    const service = new ClearCurrentPedalboardService(writeApi as never, true);

    const result = await service.clear({ confirm: true });

    expect(result.success).toBe(true);
    expect(result.before.pluginCount).toBe(0);
    expect(result.after.pluginCount).toBe(0);
    expect(result.removedInstances).toEqual([]);
    expect(result.removeCalls).toEqual([]);
    expect(writeApi.calls).toEqual([
      { method: "GET", path: "/pedalboard/info/", body: "inspect active graph before clear" },
      { method: "GET", path: "/pedalboard/info/", body: "inspect active graph after clear" }
    ]);
  });
});

describe("clearCurrentPedalboardTool", () => {
  it("parses confirm=true and calls the clear service", async () => {
    const clear = vi.fn().mockResolvedValue({
      writeToolsEnabled: true,
      confirmed: true,
      before: {
        attempted: true,
        ok: true,
        status: 200,
        pluginCount: 0,
        plugins: [],
        text: '{"plugins":[]}'
      },
      after: {
        attempted: true,
        ok: true,
        status: 200,
        pluginCount: 0,
        plugins: [],
        text: '{"plugins":[]}'
      },
      removedInstances: [],
      removeCalls: [] as ApiCallRecord[],
      success: true,
      notes: ["Cleared."]
    });
    const result = await clearCurrentPedalboardTool({ confirm: true }, {
      clearCurrentPedalboardService: { clear }
    } as never);

    expect(clear).toHaveBeenCalledWith({ confirm: true });
    expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true });
  });
});
