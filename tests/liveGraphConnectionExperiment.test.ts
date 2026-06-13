import { describe, expect, it } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import { PluginService } from "../src/services/pluginService.js";
import {
  LiveGraphConnectionExperimentService,
  type ExperimentWebSocketLike
} from "../src/services/liveGraphConnectionExperimentService.js";
import { MockRunner } from "./mockRunner.js";

class ConnectionRunner extends MockRunner {
  async exec(command: string) {
    if (command === "lv2ls") {
      return {
        stdout:
          ["http://gareus.org/oss/lv2/tinygain#mono", "https://ca9.eu/lv2/bolliedelay"].join("\n") +
          "\n",
        stderr: "",
        code: 0
      };
    }
    if (command === "lv2ls -n") {
      return {
        stdout: ["TinyGain Mono", "Bollie Delay"].join("\n") + "\n",
        stderr: "",
        code: 0
      };
    }
    if (command.startsWith("lv2info ")) {
      if (command.includes("tinygain#mono")) {
        return {
          stdout: tinyGainInfo(),
          stderr: "",
          code: 0
        };
      }
      if (command.includes("bolliedelay")) {
        return {
          stdout: bollieDelayInfo(),
          stderr: "",
          code: 0
        };
      }
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

describe("LiveGraphConnectionExperimentService", () => {
  it("generates the expected connect/disconnect sequence and restores the baseline graph", async () => {
    const socket = new MockExperimentSocket(["loading_end"]);
    const webSocketFactory = () => socket;
    const nodes = new Map<string, string>();
    const edges = new Set<string>();

    const api = {
      calls: [] as Array<{ method: string; path: string }>,
      async getBytes(path: string): Promise<WriteHttpResponse> {
        this.calls.push({ method: "GET", path });
        if (path.startsWith("/effect/add/tinygain_mono_experiment")) {
          nodes.set("tinygain_mono_experiment", "http://gareus.org/oss/lv2/tinygain#mono");
          socket.emit(
            "add /tinygain_mono_experiment http://gareus.org/oss/lv2/tinygain#mono 120 120 0 0 0"
          );
        } else if (path.startsWith("/effect/add/bollie_delay_experiment")) {
          nodes.set("bollie_delay_experiment", "https://ca9.eu/lv2/bolliedelay");
          socket.emit("add /bollie_delay_experiment https://ca9.eu/lv2/bolliedelay 360 140 0 0 0");
        } else if (path.startsWith("/effect/connect/")) {
          const [, pair] = path.split("/effect/connect/");
          const [source, target] = pair.split(",", 2);
          edges.add(`${source}->${target}`);
          socket.emit(`connect ${source} ${target}`);
        } else if (path.startsWith("/effect/disconnect/")) {
          const [, pair] = path.split("/effect/disconnect/");
          const [source, target] = pair.split(",", 2);
          edges.delete(`${source}->${target}`);
          socket.emit(`disconnect ${source} ${target}`);
        } else if (path === "/effect/remove/bollie_delay_experiment") {
          nodes.delete("bollie_delay_experiment");
          socket.emit("remove /bollie_delay_experiment");
        } else if (path === "/effect/remove/tinygain_mono_experiment") {
          nodes.delete("tinygain_mono_experiment");
          socket.emit("remove /tinygain_mono_experiment");
        }
        return {
          ok: true,
          status: 200,
          body: Buffer.from("ok"),
          text: "ok"
        };
      }
    };

    const service = new LiveGraphConnectionExperimentService(
      new PluginService(new ConnectionRunner()),
      api as never,
      "ws://example.test/websocket",
      webSocketFactory
    );

    const result = await service.runTwoPluginConnectionExperiment({ confirm: true });

    expect(result.success).toBe(true);
    expect(result.apiCalls.map((call) => call.path)).toEqual([
      "/effect/add/tinygain_mono_experiment?x=120&y=120&uri=http%3A//gareus.org/oss/lv2/tinygain%23mono",
      "/effect/add/bollie_delay_experiment?x=360&y=140&uri=https%3A//ca9.eu/lv2/bolliedelay",
      "/effect/connect//graph/capture_1,/graph/tinygain_mono_experiment/in",
      "/effect/connect//graph/tinygain_mono_experiment/out,/graph/bollie_delay_experiment/in_l",
      "/effect/connect//graph/tinygain_mono_experiment/out,/graph/bollie_delay_experiment/in_r",
      "/effect/connect//graph/bollie_delay_experiment/out_l,/graph/playback_1",
      "/effect/connect//graph/bollie_delay_experiment/out_r,/graph/playback_2",
      "/effect/disconnect//graph/bollie_delay_experiment/out_r,/graph/playback_2",
      "/effect/disconnect//graph/bollie_delay_experiment/out_l,/graph/playback_1",
      "/effect/disconnect//graph/tinygain_mono_experiment/out,/graph/bollie_delay_experiment/in_r",
      "/effect/disconnect//graph/tinygain_mono_experiment/out,/graph/bollie_delay_experiment/in_l",
      "/effect/disconnect//graph/capture_1,/graph/tinygain_mono_experiment/in",
      "/effect/remove/bollie_delay_experiment",
      "/effect/remove/tinygain_mono_experiment"
    ]);

    expect(result.websocket.finalMatchesBaseline).toBe(true);
    expect(result.websocket.expectedEdgesObserved).toBe(true);
    expect(result.websocket.addObserved).toBe(true);
    expect(result.websocket.connectObserved).toBe(true);
    expect(result.websocket.disconnectObserved).toBe(true);
    expect(result.websocket.removeObserved).toBe(true);
    expect(result.websocket.afterConnects.edges).toHaveLength(5);
    expect(result.websocket.afterConnects.edges).toEqual(
      expect.arrayContaining([
        { source: "capture_1", target: "tinygain_mono_experiment/in" },
        { source: "tinygain_mono_experiment/out", target: "bollie_delay_experiment/in_l" },
        { source: "tinygain_mono_experiment/out", target: "bollie_delay_experiment/in_r" },
        { source: "bollie_delay_experiment/out_l", target: "playback_1" },
        { source: "bollie_delay_experiment/out_r", target: "playback_2" }
      ])
    );
    expect(result.websocket.final.nodes).toEqual([]);
    expect(result.websocket.final.edges).toEqual([]);
  }, 15000);
});

function tinyGainInfo(): string {
  return [
    "http://gareus.org/oss/lv2/tinygain#mono",
    "",
    "\tPort 0:",
    "\t\tType:        http://lv2plug.in/ns/lv2core#InputPort",
    "\t\t             http://lv2plug.in/ns/lv2core#ControlPort",
    "\t\tSymbol:      gain",
    "\t\tName:        Gain",
    "",
    "\tPort 4:",
    "\t\tType:        http://lv2plug.in/ns/lv2core#AudioPort",
    "\t\t             http://lv2plug.in/ns/lv2core#InputPort",
    "\t\tSymbol:      in",
    "\t\tName:        In",
    "",
    "\tPort 5:",
    "\t\tType:        http://lv2plug.in/ns/lv2core#AudioPort",
    "\t\t             http://lv2plug.in/ns/lv2core#OutputPort",
    "\t\tSymbol:      out",
    "\t\tName:        Out"
  ].join("\n");
}

function bollieDelayInfo(): string {
  return [
    "https://ca9.eu/lv2/bolliedelay",
    "",
    "\tPort 15:",
    "\t\tType:        http://lv2plug.in/ns/lv2core#AudioPort",
    "\t\t             http://lv2plug.in/ns/lv2core#InputPort",
    "\t\tSymbol:      in_l",
    "\t\tName:        In L",
    "",
    "\tPort 17:",
    "\t\tType:        http://lv2plug.in/ns/lv2core#AudioPort",
    "\t\t             http://lv2plug.in/ns/lv2core#OutputPort",
    "\t\tSymbol:      out_l",
    "\t\tName:        Out L"
  ].join("\n");
}
