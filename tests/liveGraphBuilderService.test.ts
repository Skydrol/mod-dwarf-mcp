import { describe, expect, it } from "vitest";
import type { WriteHttpResponse } from "../src/clients/writeHttpClient.js";
import type { LiveGraphAuthoringPlan } from "../src/types/liveGraphAuthoringPlan.js";
import {
  LiveGraphBuilderService,
  type LiveGraphBuilderWebSocketLike
} from "../src/services/liveGraphBuilderService.js";

class MockBuilderSocket implements LiveGraphBuilderWebSocketLike {
  public onopen: ((event: unknown) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public onclose: ((event: unknown) => void) | null = null;

  constructor(initialMessages: string[]) {
    setTimeout(() => {
      this.onopen?.({});
      for (const message of initialMessages) {
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

describe("LiveGraphBuilderService", () => {
  it("dry-run returns UI-compatible paths without calling the device", async () => {
    const plan = makePlan();
    const service = new LiveGraphBuilderService(
      {
        calls: [],
        async getBytes(): Promise<WriteHttpResponse> {
          throw new Error("should not be called");
        },
        async postForm(): Promise<WriteHttpResponse> {
          throw new Error("should not be called");
        }
      } as never,
      true,
      "ws://example.test/websocket",
      () => {
        throw new Error("websocket should not be opened in dry-run");
      }
    );

    const result = await service.run({
      mode: "dry_run",
      confirm: false,
      plan
    });

    expect(result.dryRun).toBe(true);
    expect(result.success).toBe(true);
    expect(result.apiCalls.map((call) => call.path)).toEqual([
      "/effect/add//graph/stereo_api_probe?x=713.569580078125&y=266.78993225097656&uri=http%3A//gareus.org/oss/lv2/tinygain%23stereo",
      "/effect/connect//graph/capture_1,/graph/stereo_api_probe/inL",
      "/effect/connect//graph/capture_2,/graph/stereo_api_probe/inR",
      "/effect/connect//graph/stereo_api_probe/outL,/graph/playback_1",
      "/effect/connect//graph/stereo_api_probe/outR,/graph/playback_2",
      "/effect/parameter/set/"
    ]);
  });

  it("refuses apply_temporary without confirm", async () => {
    const plan = makePlan();
    const writeApi = makeWriteApi([], []);
    const service = new LiveGraphBuilderService(
      writeApi.api as never,
      true,
      "ws://example.test/websocket"
    );

    const result = await service.run({
      mode: "apply_temporary",
      confirm: false,
      plan
    });

    expect(result.success).toBe(false);
    expect(result.unexpectedBehavior[0]).toContain("confirm=true");
    expect(writeApi.calls).toEqual([]);
  });

  it("applies, validates websocket events, and rolls back in reverse order", async () => {
    const initialMessages = [
      "add /graph/stereo http://gareus.org/oss/lv2/tinygain#stereo 0 0 false 0 0",
      "connect /graph/capture_1 /graph/stereo/inL",
      "connect /graph/capture_2 /graph/stereo/inR",
      "connect /graph/stereo/outL /graph/playback_1",
      "connect /graph/stereo/outR /graph/playback_2",
      "loading_end"
    ];
    const socket = new MockBuilderSocket(initialMessages);
    const writeApi = makeWriteApi(socket, []);
    const service = new LiveGraphBuilderService(
      writeApi.api as never,
      true,
      "ws://example.test/websocket",
      () => socket
    );

    const result = await service.run({
      mode: "apply_temporary",
      confirm: true,
      restoreAfterSeconds: 0,
      plan: makePlan()
    });

    expect(result.success).toBe(true);
    expect(result.websocket.addObserved).toBe(true);
    expect(result.websocket.connectObserved).toBe(true);
    expect(result.websocket.disconnectObserved).toBe(true);
    expect(result.websocket.removeObserved).toBe(true);
    expect(result.websocket.finalMatchesBaseline).toBe(true);
    expect(result.apiCalls.map((call) => call.path)).toEqual([
      "/effect/disconnect//graph/stereo/outR,/graph/playback_2",
      "/effect/disconnect//graph/stereo/outL,/graph/playback_1",
      "/effect/disconnect//graph/capture_2,/graph/stereo/inR",
      "/effect/disconnect//graph/capture_1,/graph/stereo/inL",
      "/effect/add//graph/stereo_api_probe?x=713.569580078125&y=266.78993225097656&uri=http%3A//gareus.org/oss/lv2/tinygain%23stereo",
      "/effect/connect//graph/capture_1,/graph/stereo_api_probe/inL",
      "/effect/connect//graph/capture_2,/graph/stereo_api_probe/inR",
      "/effect/connect//graph/stereo_api_probe/outL,/graph/playback_1",
      "/effect/connect//graph/stereo_api_probe/outR,/graph/playback_2",
      "/effect/parameter/set/",
      "/effect/disconnect//graph/stereo_api_probe/outR,/graph/playback_2",
      "/effect/disconnect//graph/stereo_api_probe/outL,/graph/playback_1",
      "/effect/disconnect//graph/capture_2,/graph/stereo_api_probe/inR",
      "/effect/disconnect//graph/capture_1,/graph/stereo_api_probe/inL",
      "/effect/remove//graph/stereo_api_probe",
      "/effect/connect//graph/capture_1,/graph/stereo/inL",
      "/effect/connect//graph/capture_2,/graph/stereo/inR",
      "/effect/connect//graph/stereo/outL,/graph/playback_1",
      "/effect/connect//graph/stereo/outR,/graph/playback_2"
    ]);
  });
});

function makePlan(): LiveGraphAuthoringPlan {
  return {
    dryRun: true,
    title: "Stereo Probe",
    plugins: [
      {
        role: "stereo gain",
        name: "TinyGain Stereo",
        uri: "http://gareus.org/oss/lv2/tinygain#stereo",
        instance: "stereo_api_probe",
        x: 713.569580078125,
        y: 266.78993225097656,
        addCall: {
          method: "GET",
          path: "/effect/add//graph/stereo_api_probe?x=713.569580078125&y=266.78993225097656&uri=http%3A//gareus.org/oss/lv2/tinygain%23stereo",
          purpose: "add plugin instance stereo_api_probe",
          body: { kind: "none" }
        },
        parameterPlans: [
          {
            requestedKey: "gain",
            symbol: "gain",
            requestedRange: { min: -20, max: 20, unit: "dB" },
            resolvedRange: { min: -20, max: 20, unit: "dB" },
            value: 0.75
          }
        ],
        connectCalls: []
      }
    ],
    apiCalls: [
      {
        method: "GET",
        path: "/effect/add//graph/stereo_api_probe?x=713.569580078125&y=266.78993225097656&uri=http%3A//gareus.org/oss/lv2/tinygain%23stereo",
        purpose: "add plugin instance stereo_api_probe",
        body: { kind: "none" }
      },
      {
        method: "GET",
        path: "/effect/connect//graph/capture_1,/graph/stereo_api_probe/inL",
        purpose: "connect capture_1 to stereo_api_probe/inL",
        body: { kind: "none" }
      },
      {
        method: "GET",
        path: "/effect/connect//graph/capture_2,/graph/stereo_api_probe/inR",
        purpose: "connect capture_2 to stereo_api_probe/inR",
        body: { kind: "none" }
      },
      {
        method: "GET",
        path: "/effect/connect//graph/stereo_api_probe/outL,/graph/playback_1",
        purpose: "connect stereo_api_probe/outL to playback_1",
        body: { kind: "none" }
      },
      {
        method: "GET",
        path: "/effect/connect//graph/stereo_api_probe/outR,/graph/playback_2",
        purpose: "connect stereo_api_probe/outR to playback_2",
        body: { kind: "none" }
      },
      {
        method: "POST",
        path: "/effect/parameter/set/",
        purpose: "set stereo_api_probe/gain to 0.75",
        body: {
          kind: "json",
          value: {
            instance: "/graph/stereo_api_probe",
            symbol: "gain",
            value: 0.75
          }
        }
      },
      {
        method: "POST",
        path: "/pedalboard/save",
        purpose: "save current live graph as a new pedalboard",
        body: { kind: "none" }
      }
    ],
    notes: ["plan"],
    unsupportedIdeas: [],
    validation: {
      valid: true,
      errors: [],
      pluginUris: {
        valid: true,
        checked: ["http://gareus.org/oss/lv2/tinygain#stereo"],
        missing: []
      },
      ports: { valid: true, errors: [] },
      connections: { valid: true, errors: [], callCount: 4 },
      parameters: { valid: true, errors: [], callCount: 1 },
      snapshotSave: { included: false, valid: true, note: "" },
      pedalboardSave: { valid: true, title: "Stereo Probe" }
    }
  } as LiveGraphAuthoringPlan;
}

function makeWriteApi(
  socket: MockBuilderSocket,
  calls: Array<{ method: string; path: string; body?: unknown }>
): {
  api: {
    calls: Array<{ method: string; path: string; body?: unknown }>;
    getBytes(path: string, purpose: string): Promise<WriteHttpResponse>;
    postForm(
      path: string,
      fields: Record<string, string | number | boolean>,
      purpose: string
    ): Promise<WriteHttpResponse>;
  };
  calls: Array<{ method: string; path: string; body?: unknown }>;
} {
  return {
    api: {
      calls,
      async getBytes(path: string): Promise<WriteHttpResponse> {
        calls.push({ method: "GET", path });
        emitForPath(socket, path);
        return {
          ok: true,
          status: 200,
          body: Buffer.from("true"),
          text: "true"
        };
      },
      async postForm(
        path: string,
        fields: Record<string, string | number | boolean>
      ): Promise<WriteHttpResponse> {
        calls.push({ method: "POST", path, body: fields });
        return {
          ok: true,
          status: 200,
          body: Buffer.from("true"),
          text: "true"
        };
      }
    },
    calls
  };
}

function emitForPath(socket: MockBuilderSocket, path: string): void {
  if (path.startsWith("/effect/disconnect//graph/")) {
    const pair = path.split("/effect/disconnect/")[1];
    const [source, target] = pair.split(",", 2);
    socket.emit(`disconnect ${source} ${target}`);
    return;
  }
  if (path.startsWith("/effect/connect//graph/")) {
    const pair = path.split("/effect/connect/")[1];
    const [source, target] = pair.split(",", 2);
    socket.emit(`connect ${source} ${target}`);
    return;
  }
  if (path.startsWith("/effect/add//graph/stereo_api_probe")) {
    socket.emit(
      "add /graph/stereo_api_probe http://gareus.org/oss/lv2/tinygain#stereo 713.6 266.8 false 0 0"
    );
    return;
  }
  if (path === "/effect/remove//graph/stereo_api_probe") {
    socket.emit("remove /graph/stereo_api_probe");
  }
}
