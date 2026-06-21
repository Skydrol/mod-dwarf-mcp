import { describe, expect, it } from "vitest";
import { GraphEditorService } from "../src/services/graphEditorService.js";

describe("GraphEditorService", () => {
  it("sets parameters using the POST body format accepted by the MOD firmware", async () => {
    const writeApi = new MockWriteApi();
    const service = new GraphEditorService(
      {
        inspectPedalboard: async () => ({
          bundlePath: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard",
          title: "electric guitar Pride and Joy",
          source: "user",
          files: {
            manifest: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard/manifest.ttl",
            mainTtl: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard/electric_guitar_.ttl",
            addressings: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard/addressings.json",
            snapshots: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard/snapshots.json",
            presets: null,
            thumbnail: null,
            screenshot: null
          },
          pluginsUsed: [{ instance: "master_output_6", uri: "http://moddevices.com/plugins/mod-devel/Gain2x2" }],
          connections: [],
          mappings: null,
          snapshots: [],
          metadata: {
            format: "lv2-bundle",
            ttlBased: true,
            jsonSidecars: ["/root/.pedalboards/Pride_and_Joy_SR.pedalboard/addressings.json"]
          }
        })
      } as never,
      {
        getPluginPorts: async () => ({
          uri: "http://moddevices.com/plugins/mod-devel/Gain2x2",
          ports: [
            { symbol: "In1", name: "In 1", kind: "audio", direction: "input", properties: [] },
            { symbol: "In2", name: "In 2", kind: "audio", direction: "input", properties: [] },
            { symbol: "Out1", name: "Out 1", kind: "audio", direction: "output", properties: [] },
            { symbol: "Out2", name: "Out 2", kind: "audio", direction: "output", properties: [] },
            { symbol: "Gain", name: "Level", kind: "control", direction: "input", minimum: -40, maximum: 40, default: 0, properties: [] }
          ],
          audioInputs: [],
          audioOutputs: [],
          controlInputs: [
            { symbol: "Gain", name: "Level", kind: "control", direction: "input", minimum: -40, maximum: 40, default: 0, properties: [] }
          ]
        })
      } as never,
      writeApi as never
    );

    const result = await service.setEffectParameter({
      bundlepath: "/root/.pedalboards/Pride_and_Joy_SR.pedalboard",
      instance: "master_output_6",
      parameters: { Gain: 12 },
      confirm: true
    });

    expect(result.success).toBe(true);
    expect(writeApi.calls.map((call) => call.path)).toEqual([
      "/pedalboard/load_bundle/",
      "/effect/parameter/set/",
      "/pedalboard/save"
    ]);
    expect(writeApi.calls[1]?.body).toBe("/graph/master_output_6/Gain/12");
  });
});

class MockWriteApi {
  public readonly calls: Array<{ method: "GET" | "POST"; path: string; body?: unknown }> = [];

  async postForm(path: string, fields: Record<string, string | number | boolean>): Promise<{
    ok: boolean;
    status: number;
    body: Buffer;
    text: string;
  }> {
    this.calls.push({ method: "POST", path, body: fields });
    return ok();
  }

  async postJson(path: string, body: unknown): Promise<{
    ok: boolean;
    status: number;
    body: Buffer;
    text: string;
  }> {
    this.calls.push({ method: "POST", path, body });
    return ok();
  }
}

function ok() {
  return {
    ok: true,
    status: 200,
    body: Buffer.from("true"),
    text: "true"
  };
}
