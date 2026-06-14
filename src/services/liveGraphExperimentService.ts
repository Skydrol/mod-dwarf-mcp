import type { PluginService } from "./pluginService.js";
import type { WriteHttpClient, WriteHttpResponse } from "../clients/writeHttpClient.js";
import type {
  LiveGraphExperimentInspection,
  LiveGraphExperimentResult
} from "../types/liveGraphExperiment.js";
import type { ApiCallRecord } from "../types/importBundle.js";
import { canonicalGraphRef, uiGraphInstancePath } from "./liveGraphRefs.js";

export interface ExperimentWebSocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  close(code?: number, reason?: string): void;
}

export type ExperimentWebSocketFactory = (url: string) => ExperimentWebSocketLike;

const DEFAULT_INSTANCE = "tinygain_mono_experiment";
const DEFAULT_X = 120;
const DEFAULT_Y = 120;

export class LiveGraphExperimentService {
  constructor(
    private readonly pluginService: PluginService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly websocketUrl: string,
    private readonly websocketFactory: ExperimentWebSocketFactory = defaultWebSocketFactory
  ) {}

  async runTinyGainMonoExperiment(input: { confirm: true }): Promise<LiveGraphExperimentResult> {
    void input;

    if (!this.writeApi) {
      return this.disabledResult("Write tools are disabled.");
    }

    const plugin = await this.resolveTinyGainMono();
    if (!plugin) {
      return this.failureResult(
        {
          name: "TinyGain Mono",
          uri: "",
          instance: DEFAULT_INSTANCE,
          x: DEFAULT_X,
          y: DEFAULT_Y
        },
        [],
        {
          attempted: false,
          ok: false,
          status: null,
          pluginUris: [],
          text: "",
          error: "TinyGain Mono is not installed on this device."
        },
        "TinyGain Mono is not installed on this device."
      );
    }

    const monitor = await GraphWebsocketMonitor.open(this.websocketUrl, this.websocketFactory);
    const apiCalls: ApiCallRecord[] = [];
    const inspectionBefore = await this.inspectActiveGraph(apiCalls, "before add");
    const unexpectedBehavior: string[] = [];
    await monitor.waitFor((raw) => raw.startsWith("loading_end"), 1500).catch(() => null);
    const websocketBefore = monitor.captureState();

    let addSucceeded = false;
    let removeSucceeded = false;
    let inspectionAfterAdd = inspectionBefore;
    let inspectionAfterRemove = inspectionBefore;
    let websocketAfterAdd = websocketBefore;
    let websocketAfterRemove = websocketBefore;

    try {
      const addPath = `/effect/add/${uiGraphInstancePath(plugin.instance)}?x=${DEFAULT_X}&y=${DEFAULT_Y}&uri=${legacyEscape(
        plugin.uri
      )}`;
      const addResponse = await this.writeApi.getBytes(
        addPath,
        "add TinyGain Mono to the active graph"
      );
      apiCalls.push(
        recordCall("GET", addPath, "add TinyGain Mono to the active graph", addResponse)
      );
      addSucceeded = addResponse.ok;

      await monitor
        .waitFor((raw) => matchesGraphEvent(raw, "add", plugin.instance), 5000)
        .catch((error) => {
          unexpectedBehavior.push(
            error instanceof Error ? error.message : "Timed out waiting for websocket add event"
          );
        });
      await pause(500);
      inspectionAfterAdd = await this.inspectActiveGraph(apiCalls, "after add");
      websocketAfterAdd = monitor.captureState();

      const removePath = `/effect/remove/${uiGraphInstancePath(plugin.instance)}`;
      const removeResponse = await this.writeApi.getBytes(
        removePath,
        "remove TinyGain Mono from the active graph"
      );
      apiCalls.push(
        recordCall("GET", removePath, "remove TinyGain Mono from the active graph", removeResponse)
      );
      removeSucceeded = removeResponse.ok;

      await monitor
        .waitFor((raw) => matchesGraphEvent(raw, "remove", plugin.instance), 5000)
        .catch((error) => {
          unexpectedBehavior.push(
            error instanceof Error ? error.message : "Timed out waiting for websocket remove event"
          );
        });
      await pause(500);
      inspectionAfterRemove = await this.inspectActiveGraph(apiCalls, "after remove");
      websocketAfterRemove = monitor.captureState();

      const websocketObservedAdd = websocketAfterAdd.rawMessages.some((raw) =>
        matchesGraphEvent(raw, "add", plugin.instance)
      );
      const websocketObservedRemove = websocketAfterRemove.rawMessages.some((raw) =>
        matchesGraphEvent(raw, "remove", plugin.instance)
      );
      const returnedToBaseline = sameInstanceSet(
        websocketBefore.afterRemoveInstances,
        websocketAfterRemove.afterRemoveInstances
      );
      const activeAddMatches = inspectionAfterAdd.pluginUris.includes(plugin.uri);
      const activeRemoveCleared = !inspectionAfterRemove.pluginUris.includes(plugin.uri);
      const success =
        addSucceeded &&
        removeSucceeded &&
        websocketObservedAdd &&
        websocketObservedRemove &&
        returnedToBaseline &&
        activeAddMatches &&
        activeRemoveCleared &&
        inspectionAfterAdd.ok &&
        inspectionAfterRemove.ok;

      if (!inspectionAfterAdd.ok) {
        unexpectedBehavior.push(
          `Active graph inspection after add failed: ${inspectionAfterAdd.error ?? inspectionAfterAdd.text}`
        );
      }
      if (!inspectionAfterRemove.ok) {
        unexpectedBehavior.push(
          `Active graph inspection after remove failed: ${inspectionAfterRemove.error ?? inspectionAfterRemove.text}`
        );
      }
      if (!websocketObservedAdd) {
        unexpectedBehavior.push("Websocket did not report the TinyGain Mono add event.");
      }
      if (!websocketObservedRemove) {
        unexpectedBehavior.push("Websocket did not report the TinyGain Mono remove event.");
      }
      if (!returnedToBaseline) {
        unexpectedBehavior.push(
          "Websocket graph state did not return to the baseline set of instances."
        );
      }

      return {
        dryRun: false,
        confirm: true,
        plugin,
        websocket: {
          url: websocketBefore.url,
          rawMessages: websocketAfterRemove.rawMessages,
          addObserved: websocketObservedAdd,
          removeObserved: websocketObservedRemove,
          baselineInstances: websocketBefore.afterRemoveInstances,
          afterAddInstances: websocketAfterAdd.afterAddInstances,
          afterRemoveInstances: websocketAfterRemove.afterRemoveInstances
        },
        activeGraphInspection: {
          before: inspectionBefore,
          afterAdd: inspectionAfterAdd,
          afterRemove: inspectionAfterRemove
        },
        apiCalls,
        success,
        unexpectedBehavior,
        notes: [
          "Experiment used only /effect/add and /effect/remove for mutation.",
          "No pedalboard save, load, import, snapshot, or bank operation was attempted."
        ]
      };
    } finally {
      if (addSucceeded && !removeSucceeded) {
        try {
          const cleanupPath = `/effect/remove/${uiGraphInstancePath(plugin.instance)}`;
          const cleanupResponse = await this.writeApi.getBytes(
            cleanupPath,
            "cleanup TinyGain Mono experiment"
          );
          apiCalls.push(
            recordCall("GET", cleanupPath, "cleanup TinyGain Mono experiment", cleanupResponse)
          );
        } catch {
          // Best-effort cleanup only.
        }
      }
      await monitor.close();
    }
  }

  private async resolveTinyGainMono(): Promise<{
    name: string;
    uri: string;
    instance: string;
    x: number;
    y: number;
  } | null> {
    const pluginList = await this.pluginService.listPlugins("both");
    const match = pluginList.plugins.find(
      (plugin) => normalize(plugin.name ?? "") === normalize("TinyGain Mono")
    );
    if (!match?.uri || !match.name) return null;
    return {
      name: match.name,
      uri: match.uri,
      instance: DEFAULT_INSTANCE,
      x: DEFAULT_X,
      y: DEFAULT_Y
    };
  }

  private async inspectActiveGraph(
    apiCalls: ApiCallRecord[],
    purposeSuffix: string
  ): Promise<LiveGraphExperimentInspection> {
    const writeApi = this.writeApi;
    if (!writeApi) {
      return {
        attempted: true,
        ok: false,
        status: null,
        pluginUris: [],
        text: "",
        error: "Write API is not configured"
      };
    }
    try {
      const response = await writeApi.getJson<{ plugins?: Array<{ uri?: string }> }>(
        "/pedalboard/info/",
        `inspect active graph ${purposeSuffix}`
      );
      apiCalls.push({
        method: "GET",
        path: "/pedalboard/info/",
        purpose: `inspect active graph ${purposeSuffix}`,
        status: response.ok ? "success" : "failed",
        httpStatus: response.status
      });
      const pluginUris = Array.isArray(response.value?.plugins)
        ? response.value.plugins
            .map((plugin) => plugin.uri)
            .filter((uri): uri is string => Boolean(uri))
        : [];
      return {
        attempted: true,
        ok: response.ok && pluginUris.length > 0,
        status: response.status,
        pluginUris,
        text: response.text,
        error:
          response.ok && pluginUris.length > 0
            ? undefined
            : response.ok
              ? "MOD UI returned no plugins for the active graph."
              : `HTTP ${response.status} from /pedalboard/info/`
      };
    } catch (error) {
      apiCalls.push({
        method: "GET",
        path: "/pedalboard/info/",
        purpose: `inspect active graph ${purposeSuffix}`,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        attempted: true,
        ok: false,
        status: null,
        pluginUris: [],
        text: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private disabledResult(error: string): LiveGraphExperimentResult {
    return {
      dryRun: false,
      confirm: true,
      plugin: {
        name: "TinyGain Mono",
        uri: "",
        instance: DEFAULT_INSTANCE,
        x: DEFAULT_X,
        y: DEFAULT_Y
      },
      websocket: {
        url: this.websocketUrl,
        rawMessages: [],
        addObserved: false,
        removeObserved: false,
        baselineInstances: [],
        afterAddInstances: [],
        afterRemoveInstances: []
      },
      activeGraphInspection: {
        before: { attempted: false, ok: false, status: null, pluginUris: [], text: "", error },
        afterAdd: { attempted: false, ok: false, status: null, pluginUris: [], text: "", error },
        afterRemove: { attempted: false, ok: false, status: null, pluginUris: [], text: "", error }
      },
      apiCalls: [],
      success: false,
      unexpectedBehavior: [error],
      notes: ["Write tools are disabled by configuration."]
    };
  }

  private failureResult(
    plugin: { name: string; uri: string; instance: string; x: number; y: number },
    apiCalls: ApiCallRecord[],
    inspection: LiveGraphExperimentInspection,
    error: string
  ): LiveGraphExperimentResult {
    return {
      dryRun: false,
      confirm: true,
      plugin,
      websocket: {
        url: this.websocketUrl,
        rawMessages: [],
        addObserved: false,
        removeObserved: false,
        baselineInstances: [],
        afterAddInstances: [],
        afterRemoveInstances: []
      },
      activeGraphInspection: {
        before: inspection,
        afterAdd: inspection,
        afterRemove: inspection
      },
      apiCalls,
      success: false,
      unexpectedBehavior: [error],
      notes: ["Experiment aborted before any live graph mutation."]
    };
  }
}

class GraphWebsocketMonitor {
  private readonly messages: string[] = [];
  private readonly instances = new Map<string, string>();
  private readonly waiters: Array<{
    predicate: (message: string) => boolean;
    resolve: (message: string) => void;
  }> = [];
  private socket: ExperimentWebSocketLike | null = null;
  private opened = false;

  private constructor(
    private readonly url: string,
    private readonly factory: ExperimentWebSocketFactory
  ) {}

  static async open(
    url: string,
    factory: ExperimentWebSocketFactory
  ): Promise<GraphWebsocketMonitor> {
    const monitor = new GraphWebsocketMonitor(url, factory);
    await monitor.open();
    return monitor;
  }

  snapshot(): {
    url: string;
    rawMessages: string[];
    addObserved: boolean;
    removeObserved: boolean;
    baselineInstances: Array<{ instance: string; uri: string }>;
    afterAddInstances: Array<{ instance: string; uri: string }>;
    afterRemoveInstances: Array<{ instance: string; uri: string }>;
  } {
    const instances = [...this.instances.entries()].map(([instance, uri]) => ({ instance, uri }));
    const observedAdds = this.messages.some((message) => message.startsWith("add "));
    const observedRemoves = this.messages.some((message) => message.startsWith("remove "));
    return {
      url: this.url,
      rawMessages: [...this.messages],
      addObserved: observedAdds,
      removeObserved: observedRemoves,
      baselineInstances: instances,
      afterAddInstances: instances,
      afterRemoveInstances: instances
    };
  }

  captureState(): {
    url: string;
    rawMessages: string[];
    addObserved: boolean;
    removeObserved: boolean;
    baselineInstances: Array<{ instance: string; uri: string }>;
    afterAddInstances: Array<{ instance: string; uri: string }>;
    afterRemoveInstances: Array<{ instance: string; uri: string }>;
  } {
    return this.snapshot();
  }

  async waitFor(predicate: (message: string) => boolean, timeoutMs: number): Promise<string> {
    if (!this.opened) {
      throw new Error("Websocket monitor is not open");
    }
    const existing = this.messages.find(predicate);
    if (existing) return existing;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for websocket message")),
        timeoutMs
      );
      this.waiters.push({
        predicate,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        }
      });
    });
  }

  async close(): Promise<void> {
    this.socket?.close();
  }

  private async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = this.factory(this.url);
      this.socket = socket;
      socket.onopen = () => {
        this.opened = true;
        resolve();
      };
      socket.onerror = (event) => {
        reject(
          new Error(
            `Websocket error: ${String((event as { message?: string }).message ?? "unknown")}`
          )
        );
      };
      socket.onmessage = (event) => {
        const message = String(event.data);
        this.messages.push(message);
        const parsed = parseGraphMessage(message);
        if (parsed.type === "add" && parsed.instance && parsed.uri) {
          this.instances.set(parsed.instance, parsed.uri);
        }
        if (parsed.type === "remove" && parsed.instance) {
          this.instances.delete(parsed.instance);
        }
        for (let index = 0; index < this.waiters.length; index += 1) {
          const waiter = this.waiters[index];
          if (waiter.predicate(message)) {
            this.waiters.splice(index, 1);
            waiter.resolve(message);
            break;
          }
        }
      };
    });
  }
}

function parseGraphMessage(
  raw: string
):
  | { type: "add"; instance?: string; uri?: string }
  | { type: "remove"; instance?: string }
  | { type: "other" } {
  const parts = raw.trim().split(/\s+/);
  if (parts[0] === "add" && parts.length >= 3) {
    return { type: "add", instance: parts[1], uri: parts[2] };
  }
  if (parts[0] === "remove" && parts.length >= 2) {
    return { type: "remove", instance: parts[1] };
  }
  return { type: "other" };
}

function recordCall(
  method: "GET" | "POST",
  path: string,
  purpose: string,
  response: WriteHttpResponse
): ApiCallRecord {
  return {
    method,
    path,
    purpose,
    status: response.ok ? "success" : "failed",
    httpStatus: response.status
  };
}

function sameInstanceSet(
  a: Array<{ instance: string; uri: string }>,
  b: Array<{ instance: string; uri: string }>
): boolean {
  if (a.length !== b.length) return false;
  const left = a.map((item) => `${item.instance}=${item.uri}`).sort();
  const right = b.map((item) => `${item.instance}=${item.uri}`).sort();
  return left.every((value, index) => value === right[index]);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function legacyEscape(value: string): string {
  return escape(value);
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesGraphEvent(raw: string, kind: "add" | "remove", instance: string): boolean {
  const parsed = parseGraphMessage(raw);
  if (parsed.type !== kind) return false;
  return canonicalGraphRef(parsed.instance ?? "") === canonicalGraphRef(instance);
}

function defaultWebSocketFactory(url: string): ExperimentWebSocketLike {
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    throw new Error("WebSocket is not available in this runtime");
  }
  return new WebSocketCtor(url) as unknown as ExperimentWebSocketLike;
}
