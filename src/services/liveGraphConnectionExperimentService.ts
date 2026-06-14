import type { WriteHttpClient, WriteHttpResponse } from "../clients/writeHttpClient.js";
import type { PluginService } from "./pluginService.js";
import type {
  LiveGraphConnectionExperimentGraphState,
  LiveGraphConnectionExperimentPlugin,
  LiveGraphConnectionExperimentResult
} from "../types/liveGraphConnectionExperiment.js";
import type { ApiCallRecord } from "../types/importBundle.js";
import type {
  ExperimentWebSocketFactory,
  ExperimentWebSocketLike
} from "./liveGraphExperimentService.js";
import {
  canonicalGraphRef,
  graphEdgeKey,
  uiGraphInstancePath,
  uiGraphRef
} from "./liveGraphRefs.js";

const TINYGAIN_INSTANCE = "tinygain_mono_experiment";
const BOLLIE_INSTANCE = "bollie_delay_experiment";

const TINYGAIN_URI = "http://gareus.org/oss/lv2/tinygain#mono";
const BOLLIE_URI = "https://ca9.eu/lv2/bolliedelay";

const TINYGAIN_POS = { x: 120, y: 120 };
const BOLLIE_POS = { x: 360, y: 140 };

const EXPECTED_CONNECTIONS = [
  { source: "capture_1", target: `${TINYGAIN_INSTANCE}/in` },
  { source: `${TINYGAIN_INSTANCE}/out`, target: `${BOLLIE_INSTANCE}/in_l` },
  { source: `${TINYGAIN_INSTANCE}/out`, target: `${BOLLIE_INSTANCE}/in_r` },
  { source: `${BOLLIE_INSTANCE}/out_l`, target: "playback_1" },
  { source: `${BOLLIE_INSTANCE}/out_r`, target: "playback_2" }
];

export class LiveGraphConnectionExperimentService {
  constructor(
    private readonly pluginService: PluginService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly websocketUrl: string,
    private readonly websocketFactory: ExperimentWebSocketFactory = defaultWebSocketFactory
  ) {}

  async runTwoPluginConnectionExperiment(input: {
    confirm: true;
  }): Promise<LiveGraphConnectionExperimentResult> {
    void input;

    if (!this.writeApi) {
      return this.disabledResult("Write tools are disabled.");
    }

    const [tinygain, bollie] = await Promise.all([
      this.resolvePlugin(
        "TinyGain Mono",
        TINYGAIN_URI,
        TINYGAIN_INSTANCE,
        TINYGAIN_POS.x,
        TINYGAIN_POS.y
      ),
      this.resolvePlugin("Bollie Delay", BOLLIE_URI, BOLLIE_INSTANCE, BOLLIE_POS.x, BOLLIE_POS.y)
    ]);

    if (!tinygain || !bollie) {
      return this.failureResult(
        [tinygain, bollie].filter(Boolean) as LiveGraphConnectionExperimentPlugin[],
        "Required plugin metadata was not available."
      );
    }

    const monitor = await GraphStateMonitor.open(this.websocketUrl, this.websocketFactory);
    const apiCalls: ApiCallRecord[] = [];
    const unexpectedBehavior: string[] = [];

    await monitor.waitFor((raw) => raw.startsWith("loading_end"), 1500).catch(() => null);
    const baseline = monitor.snapshot();

    const addPaths = [this.addPath(tinygain), this.addPath(bollie)];
    const connectPaths = EXPECTED_CONNECTIONS.map((connection) =>
      this.connectPath(connection.source, connection.target)
    );
    const disconnectPaths = [...connectPaths]
      .reverse()
      .map((path) => this.disconnectFromConnectPath(path));
    const removePaths = [this.removePath(bollie.instance), this.removePath(tinygain.instance)];

    let addsComplete = false;
    let connectsComplete = false;
    let disconnectsComplete = false;
    let removesComplete = false;

    try {
      for (const path of addPaths) {
        const response = await this.writeApi.getBytes(path, `add ${path}`);
        apiCalls.push(recordCall("GET", path, `add ${path}`, response));
        if (!response.ok) {
          unexpectedBehavior.push(`Add failed: ${path} -> HTTP ${response.status}`);
        }
      }
      addsComplete = true;

      await monitor
        .waitFor((raw) => matchesInstanceEvent(raw, "add", tinygain.instance), 5000)
        .catch(() => {
          unexpectedBehavior.push("Websocket did not report TinyGain Mono add.");
        });
      await monitor
        .waitFor((raw) => matchesInstanceEvent(raw, "add", bollie.instance), 5000)
        .catch(() => {
          unexpectedBehavior.push("Websocket did not report Bollie Delay add.");
        });
      const afterAdds = monitor.snapshot();
      await pause(500);

      for (const path of connectPaths) {
        const response = await this.writeApi.getBytes(path, `connect ${path}`);
        apiCalls.push(recordCall("GET", path, `connect ${path}`, response));
        if (!response.ok) {
          unexpectedBehavior.push(`Connect failed: ${path} -> HTTP ${response.status}`);
        }
      }
      connectsComplete = true;

      for (const connection of EXPECTED_CONNECTIONS) {
        await monitor
          .waitFor(
            (raw) => matchesConnectionEvent(raw, "connect", connection.source, connection.target),
            5000
          )
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report connect for ${connection.source} -> ${connection.target}.`
            );
          });
      }
      const afterConnects = monitor.snapshot();

      for (const path of disconnectPaths) {
        const response = await this.writeApi.getBytes(path, `disconnect ${path}`);
        apiCalls.push(recordCall("GET", path, `disconnect ${path}`, response));
        if (!response.ok) {
          unexpectedBehavior.push(`Disconnect failed: ${path} -> HTTP ${response.status}`);
        }
      }
      disconnectsComplete = true;

      for (const connection of [...EXPECTED_CONNECTIONS].reverse()) {
        await monitor
          .waitFor(
            (raw) =>
              matchesConnectionEvent(raw, "disconnect", connection.source, connection.target),
            5000
          )
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report disconnect for ${connection.source} -> ${connection.target}.`
            );
          });
      }
      const afterDisconnects = monitor.snapshot();

      for (const path of removePaths) {
        const response = await this.writeApi.getBytes(path, `remove ${path}`);
        apiCalls.push(recordCall("GET", path, `remove ${path}`, response));
        if (!response.ok) {
          unexpectedBehavior.push(`Remove failed: ${path} -> HTTP ${response.status}`);
        }
      }
      removesComplete = true;

      await monitor
        .waitFor((raw) => matchesInstanceEvent(raw, "remove", bollie.instance), 5000)
        .catch(() => {
          unexpectedBehavior.push("Websocket did not report Bollie Delay remove.");
        });
      await monitor
        .waitFor((raw) => matchesInstanceEvent(raw, "remove", tinygain.instance), 5000)
        .catch(() => {
          unexpectedBehavior.push("Websocket did not report TinyGain Mono remove.");
        });
      const afterRemoves = monitor.snapshot();
      const final = afterRemoves;
      const finalMatchesBaseline = graphStateEquals(baseline, final);
      const expectedEdgesObserved = EXPECTED_CONNECTIONS.every((connection) =>
        afterConnects.edges.some(
          (edge) =>
            edge.source === canonicalGraphRef(connection.source) &&
            edge.target === canonicalGraphRef(connection.target)
        )
      );

      if (!finalMatchesBaseline) {
        unexpectedBehavior.push("Final websocket graph did not match the baseline graph.");
      }
      if (!expectedEdgesObserved) {
        unexpectedBehavior.push(
          "Websocket graph did not contain all expected edges after connect."
        );
      }

      const success =
        addsComplete &&
        connectsComplete &&
        disconnectsComplete &&
        removesComplete &&
        finalMatchesBaseline &&
        expectedEdgesObserved &&
        !unexpectedBehavior.some((entry) => entry.startsWith("Add failed")) &&
        !unexpectedBehavior.some((entry) => entry.startsWith("Connect failed")) &&
        !unexpectedBehavior.some((entry) => entry.startsWith("Disconnect failed")) &&
        !unexpectedBehavior.some((entry) => entry.startsWith("Remove failed"));

      return {
        dryRun: false,
        confirm: true,
        plugins: [tinygain, bollie],
        expectedConnections: EXPECTED_CONNECTIONS,
        websocket: {
          url: baseline.url,
          rawMessages: final.rawMessages,
          addObserved: final.rawMessages.some((raw) =>
            matchesInstanceEvent(raw, "add", tinygain.instance)
          ),
          connectObserved: final.rawMessages.some((raw) => raw.startsWith("connect ")),
          disconnectObserved: final.rawMessages.some((raw) => raw.startsWith("disconnect ")),
          removeObserved: final.rawMessages.some(
            (raw) =>
              matchesInstanceEvent(raw, "remove", tinygain.instance) ||
              matchesInstanceEvent(raw, "remove", bollie.instance)
          ),
          baseline,
          afterAdds,
          afterConnects,
          afterDisconnects,
          afterRemoves,
          final,
          finalMatchesBaseline,
          expectedEdgesObserved
        },
        apiCalls,
        success,
        unexpectedBehavior,
        notes: [
          "Experiment used only /effect/add, /effect/connect, /effect/disconnect, and /effect/remove.",
          "No pedalboard save, load, import, snapshot, or bank operation was attempted."
        ]
      };
    } finally {
      if (addsComplete && (!disconnectsComplete || !removesComplete)) {
        await bestEffortCleanup(this.writeApi, apiCalls, connectPaths, removePaths);
      }
      await monitor.close();
    }
  }

  private async resolvePlugin(
    name: string,
    uri: string,
    instance: string,
    x: number,
    y: number
  ): Promise<LiveGraphConnectionExperimentPlugin | null> {
    const list = await this.pluginService.listPlugins("both");
    const installed = list.plugins.find(
      (plugin) => plugin.uri === uri || normalize(plugin.name ?? "") === normalize(name)
    );
    if (!installed?.uri || !installed.name) return null;
    return { name: installed.name, uri: installed.uri, instance, x, y };
  }

  private addPath(plugin: LiveGraphConnectionExperimentPlugin): string {
    return `/effect/add/${uiGraphInstancePath(plugin.instance)}?x=${plugin.x}&y=${plugin.y}&uri=${legacyEscape(plugin.uri)}`;
  }

  private connectPath(source: string, target: string): string {
    return `/effect/connect/${uiGraphRef(source)},${uiGraphRef(target)}`;
  }

  private disconnectPath(source: string, target: string): string {
    return `/effect/disconnect/${uiGraphRef(source)},${uiGraphRef(target)}`;
  }

  private removePath(instance: string): string {
    return `/effect/remove/${uiGraphInstancePath(instance)}`;
  }

  private disconnectFromConnectPath(connectPath: string): string {
    const prefix = "/effect/connect/";
    const pair = connectPath.slice(prefix.length);
    const [source, target] = pair.split(",", 2);
    return this.disconnectPath(source, target);
  }

  private disabledResult(error: string): LiveGraphConnectionExperimentResult {
    return {
      dryRun: false,
      confirm: true,
      plugins: [],
      expectedConnections: EXPECTED_CONNECTIONS,
      websocket: {
        url: this.websocketUrl,
        rawMessages: [],
        addObserved: false,
        connectObserved: false,
        disconnectObserved: false,
        removeObserved: false,
        baseline: emptyGraphState(),
        afterAdds: emptyGraphState(),
        afterConnects: emptyGraphState(),
        afterDisconnects: emptyGraphState(),
        afterRemoves: emptyGraphState(),
        final: emptyGraphState(),
        finalMatchesBaseline: false,
        expectedEdgesObserved: false
      },
      apiCalls: [],
      success: false,
      unexpectedBehavior: [error],
      notes: ["Write tools are disabled by configuration."]
    };
  }

  private failureResult(
    plugins: LiveGraphConnectionExperimentPlugin[],
    error: string
  ): LiveGraphConnectionExperimentResult {
    return {
      dryRun: false,
      confirm: true,
      plugins,
      expectedConnections: EXPECTED_CONNECTIONS,
      websocket: {
        url: this.websocketUrl,
        rawMessages: [],
        addObserved: false,
        connectObserved: false,
        disconnectObserved: false,
        removeObserved: false,
        baseline: emptyGraphState(),
        afterAdds: emptyGraphState(),
        afterConnects: emptyGraphState(),
        afterDisconnects: emptyGraphState(),
        afterRemoves: emptyGraphState(),
        final: emptyGraphState(),
        finalMatchesBaseline: false,
        expectedEdgesObserved: false
      },
      apiCalls: [],
      success: false,
      unexpectedBehavior: [error],
      notes: ["Experiment aborted before any live graph mutation."]
    };
  }
}

class GraphStateMonitor {
  private readonly messages: string[] = [];
  private readonly nodes = new Map<string, string>();
  private readonly edges = new Set<string>();
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

  static async open(url: string, factory: ExperimentWebSocketFactory): Promise<GraphStateMonitor> {
    const monitor = new GraphStateMonitor(url, factory);
    await monitor.open();
    return monitor;
  }

  snapshot(): {
    url: string;
    rawMessages: string[];
    nodes: Array<{ instance: string; uri: string }>;
    edges: Array<{ source: string; target: string }>;
  } {
    return {
      url: this.url,
      rawMessages: [...this.messages],
      nodes: [...this.nodes.entries()]
        .map(([instance, uri]) => ({ instance, uri }))
        .sort((a, b) => a.instance.localeCompare(b.instance)),
      edges: [...this.edges]
        .map((edge) => {
          const [source, target] = edge.split("->", 2);
          return { source, target };
        })
        .sort((a, b) => `${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`))
    };
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
          this.nodes.set(canonicalGraphRef(parsed.instance), parsed.uri);
        }
        if (parsed.type === "remove" && parsed.instance) {
          this.nodes.delete(canonicalGraphRef(parsed.instance));
        }
        if (parsed.type === "connect" && parsed.source && parsed.target) {
          this.edges.add(graphEdgeKey(parsed.source, parsed.target));
        }
        if (parsed.type === "disconnect" && parsed.source && parsed.target) {
          this.edges.delete(graphEdgeKey(parsed.source, parsed.target));
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
  | { type: "connect"; source?: string; target?: string }
  | { type: "disconnect"; source?: string; target?: string }
  | { type: "other" } {
  const parts = raw.trim().split(/\s+/);
  switch (parts[0]) {
    case "add":
      return { type: "add", instance: parts[1], uri: parts[2] };
    case "remove":
      return { type: "remove", instance: parts[1] };
    case "connect":
      return { type: "connect", source: parts[1], target: parts[2] };
    case "disconnect":
      return { type: "disconnect", source: parts[1], target: parts[2] };
    default:
      return { type: "other" };
  }
}

function matchesInstanceEvent(raw: string, kind: "add" | "remove", instance: string): boolean {
  const parsed = parseGraphMessage(raw);
  if (parsed.type !== kind) return false;
  return (
    "instance" in parsed && canonicalGraphRef(parsed.instance ?? "") === canonicalGraphRef(instance)
  );
}

function matchesConnectionEvent(
  raw: string,
  kind: "connect" | "disconnect",
  source: string,
  target: string
): boolean {
  const parsed = parseGraphMessage(raw);
  if (parsed.type !== kind) return false;
  return (
    canonicalGraphRef(parsed.source ?? "") === canonicalGraphRef(source) &&
    canonicalGraphRef(parsed.target ?? "") === canonicalGraphRef(target)
  );
}

function graphStateEquals(
  a:
    | LiveGraphConnectionExperimentGraphState
    | {
        nodes: Array<{ instance: string; uri: string }>;
        edges: Array<{ source: string; target: string }>;
      },
  b:
    | LiveGraphConnectionExperimentGraphState
    | {
        nodes: Array<{ instance: string; uri: string }>;
        edges: Array<{ source: string; target: string }>;
      }
): boolean {
  return (
    arraysEqual(
      a.nodes.map((node) => `${canonicalGraphRef(node.instance)}=${node.uri}`).sort(),
      b.nodes.map((node) => `${canonicalGraphRef(node.instance)}=${node.uri}`).sort()
    ) &&
    arraysEqual(
      a.edges.map((edge) => graphEdgeKey(edge.source, edge.target)).sort(),
      b.edges.map((edge) => graphEdgeKey(edge.source, edge.target)).sort()
    )
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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

async function bestEffortCleanup(
  writeApi: WriteHttpClient,
  apiCalls: ApiCallRecord[],
  connectPaths: string[],
  removePaths: string[]
): Promise<void> {
  for (const path of [...connectPaths]
    .reverse()
    .map((connectPath) => disconnectPathFromConnect(connectPath))
    .concat(removePaths)) {
    try {
      const response = await writeApi.getBytes(path, "best-effort cleanup");
      apiCalls.push(recordCall("GET", path, "best-effort cleanup", response));
    } catch {
      // best effort only
    }
  }
}

function disconnectPathFromConnect(connectPath: string): string {
  const prefix = "/effect/connect/";
  const pair = connectPath.slice(prefix.length);
  const [source, target] = pair.split(",", 2);
  return `/effect/disconnect/${source},${target}`;
}

function emptyGraphState(): LiveGraphConnectionExperimentGraphState {
  return { nodes: [], edges: [] };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function legacyEscape(value: string): string {
  return escape(value);
}

function defaultWebSocketFactory(url: string): ExperimentWebSocketLike {
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    throw new Error("WebSocket is not available in this runtime");
  }
  return new WebSocketCtor(url) as unknown as ExperimentWebSocketLike;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
