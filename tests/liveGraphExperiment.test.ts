import { describe, expect, it } from "vitest";
import { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { PluginService } from "../src/services/pluginService.js";
import {
  LiveGraphExperimentService,
  type ExperimentWebSocketLike
} from "../src/services/liveGraphExperimentService.js";
import { MockRunner } from "./mockRunner.js";

class TinyGainRunner extends MockRunner {
  async exec(command: string) {
    if (command === "lv2ls") {
      return {
        stdout:
          ["http://gareus.org/oss/lv2/tinygain#mono", "http://example.com/unused"].join("\n") +
          "\n",
        stderr: "",
        code: 0
      };
    }
    if (command === "lv2ls -n") {
      return {
        stdout: ["TinyGain Mono", "Unused Plugin"].join("\n") + "\n",
        stderr: "",
        code: 0
      };
    }
    return super.exec(command);
  }
}

class MockExperimentSocket implements ExperimentWebSocketLike {
  public onopen: ((event: unknown) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public onclose: ((event: unknown) => void) | null = null;

  constructor(private readonly initialMessages: string[]) {
    setTimeout(() => {
      this.onopen?.({});
      for (const message of this.initialMessages) {
        this.onmessage?.({ data: message });
      }
    }, 0);
  }

  emit(message: string): void {
    this.onmessage?.({ data: message });
  }

  close(): void {
    this.onclose?.({});
  }
}

describe("LiveGraphExperimentService", () => {
  it("adds and removes TinyGain Mono without leaving the websocket graph changed", async () => {
    const socket = new MockExperimentSocket([
      "add capture_1 http://moddevices.com/plugins/mod-devel/Gain 0 0 false 0 0",
      "loading_end"
    ]);
    const socketFactory = () => socket;
    const activeUris = ["http://moddevices.com/plugins/mod-devel/Gain"];

    const writeApi = {
      calls: [] as Array<{ method: string; path: string }>,
      async getBytes(path: string): Promise<WriteHttpResponse> {
        this.calls.push({ method: "GET", path });
        if (path.startsWith("/effect/add/")) {
          activeUris.push("http://gareus.org/oss/lv2/tinygain#mono");
          socket.emit(
            "add /graph/tinygain_mono_experiment http://gareus.org/oss/lv2/tinygain#mono 120 120 false 0 0"
          );
        }
        if (path.startsWith("/effect/remove/")) {
          const index = activeUris.indexOf("http://gareus.org/oss/lv2/tinygain#mono");
          if (index >= 0) activeUris.splice(index, 1);
          socket.emit("remove /graph/tinygain_mono_experiment");
        }
        return {
          ok: true,
          status: 200,
          body: Buffer.from("ok"),
          text: "ok"
        };
      },
      async getJson<T>(
        path: string
      ): Promise<{ ok: boolean; status: number; value: T | null; text: string }> {
        this.calls.push({ method: "GET", path });
        const value = { plugins: activeUris.map((uri) => ({ uri })) } as T;
        return { ok: true, status: 200, value, text: JSON.stringify(value) };
      }
    };

    const service = new LiveGraphExperimentService(
      new PluginService(new TinyGainRunner()),
      writeApi as never,
      "ws://example.test/websocket",
      socketFactory
    );

    const result = await service.runTinyGainMonoExperiment({ confirm: true });

    expect(result.success).toBe(true);
    expect(result.plugin.uri).toBe("http://gareus.org/oss/lv2/tinygain#mono");
    expect(result.websocket.addObserved).toBe(true);
    expect(result.websocket.removeObserved).toBe(true);
    expect(result.websocket.afterRemoveInstances).toEqual(result.websocket.baselineInstances);
    expect(result.activeGraphInspection.afterAdd.pluginUris).toContain(
      "http://gareus.org/oss/lv2/tinygain#mono"
    );
    expect(result.activeGraphInspection.afterRemove.pluginUris).not.toContain(
      "http://gareus.org/oss/lv2/tinygain#mono"
    );
    expect(writeApi.calls.map((call) => call.path)).toEqual([
      "/pedalboard/info/",
      "/effect/add//graph/tinygain_mono_experiment?x=120&y=120&uri=http%3A//gareus.org/oss/lv2/tinygain%23mono",
      "/pedalboard/info/",
      "/effect/remove//graph/tinygain_mono_experiment",
      "/pedalboard/info/"
    ]);
  });
});
