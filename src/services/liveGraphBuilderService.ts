import type { WriteHttpClient, WriteHttpResponse } from "../clients/writeHttpClient.js";
import type {
  LiveGraphBuilderPlan,
  LiveGraphBuilderResult,
  LiveGraphBuilderWebsocketState
} from "../types/liveGraphBuilder.js";
import type { LiveGraphApiCall } from "../types/liveGraphAuthoringPlan.js";
import type { ApiCallRecord } from "../types/importBundle.js";
import {
  canonicalGraphRef,
  graphEdgeKey,
  uiGraphInstancePath,
  uiGraphRef
} from "./liveGraphRefs.js";

export interface LiveGraphBuilderWebSocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  close(code?: number, reason?: string): void;
}

export type LiveGraphBuilderWebSocketFactory = (url: string) => LiveGraphBuilderWebSocketLike;

const DEFAULT_RESTORE_AFTER_SECONDS = 5;
const SUPPORT_NAME = "stereo_linear_chain";

export class LiveGraphBuilderService {
  constructor(
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean,
    private readonly websocketUrl: string,
    private readonly websocketFactory: LiveGraphBuilderWebSocketFactory = defaultWebSocketFactory
  ) {}

  async run(input: {
    mode: "dry_run" | "apply_temporary";
    confirm: boolean;
    restoreAfterSeconds?: number;
    plan: LiveGraphBuilderPlan;
  }): Promise<LiveGraphBuilderResult> {
    const restoreAfterSeconds = input.restoreAfterSeconds ?? DEFAULT_RESTORE_AFTER_SECONDS;
    const supportedTopology: "stereo_linear_chain" = SUPPORT_NAME;

    const planAnalysis = this.analyzePlan(input.plan);
    if (!planAnalysis.supported) {
      return this.unsupportedResult(input, restoreAfterSeconds, planAnalysis.reason);
    }

    if (input.mode === "dry_run") {
      return this.dryRunResult(input, restoreAfterSeconds, planAnalysis);
    }

    if (!input.confirm) {
      return this.notAttempted(input, restoreAfterSeconds, "Tool input must include confirm=true.");
    }
    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.notAttempted(
        input,
        restoreAfterSeconds,
        "Write tools are disabled. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true and pass confirm=true."
      );
    }

    const monitor = await LiveGraphWebsocketMonitor.open(this.websocketUrl, this.websocketFactory);
    const apiCalls: ApiCallRecord[] = [];
    const unexpectedBehavior: string[] = [];
    const addCall = planAnalysis.addCall;
    const connectCalls = planAnalysis.connectCalls;
    const parameterCalls = planAnalysis.parameterCalls;
    const plugin = planAnalysis.plugin;

    await monitor.waitFor((raw) => raw.startsWith("loading_end"), 1500).catch(() => null);
    const baseline = monitor.snapshot();
    const occupiedBaselineEdges = this.findOccupiedEdges(baseline, connectCalls);
    const baselineDisconnects = [...occupiedBaselineEdges].reverse();

    let baselineDisconnected = false;
    let addSucceeded = false;
    let connectSucceeded = false;
    let parameterSucceeded = false;
    let tempDisconnectSucceeded = false;
    let removeSucceeded = false;
    let restoreSucceeded = false;
    let afterDisconnects = baseline;
    let afterAdds = baseline;
    let afterConnects = baseline;
    let afterParameters = baseline;
    let afterRollback = baseline;

    try {
      for (const edge of baselineDisconnects) {
        const path = this.disconnectPath(edge.source, edge.target);
        const response = await this.writeApi.getBytes(
          path,
          `disconnect occupied edge ${edge.source} -> ${edge.target}`
        );
        apiCalls.push(
          recordCall(
            "GET",
            path,
            `disconnect occupied edge ${edge.source} -> ${edge.target}`,
            response
          )
        );
        if (!response.ok) {
          unexpectedBehavior.push(
            `Baseline disconnect failed: ${edge.source} -> ${edge.target} -> HTTP ${response.status}`
          );
          break;
        }
        await monitor
          .waitFor(
            (raw) => matchesConnectionEvent(raw, "disconnect", edge.source, edge.target),
            5000
          )
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report baseline disconnect for ${edge.source} -> ${edge.target}.`
            );
          });
      }
      baselineDisconnected =
        baselineDisconnects.length === 0 ||
        (!unexpectedBehavior.some((entry) => entry.startsWith("Baseline disconnect failed")) &&
          !unexpectedBehavior.some((entry) =>
            entry.startsWith("Websocket did not report baseline disconnect")
          ));
      afterDisconnects = monitor.captureState();

      const addResponse = await this.writeApi.getBytes(addCall.path, addCall.purpose);
      apiCalls.push(recordCall("GET", addCall.path, addCall.purpose, addResponse));
      addSucceeded = addResponse.ok;
      if (!addResponse.ok) {
        unexpectedBehavior.push(`Add failed: ${addCall.path} -> HTTP ${addResponse.status}`);
      } else {
        await monitor
          .waitFor((raw) => matchesInstanceEvent(raw, "add", plugin.instance), 5000)
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report add for ${uiGraphInstancePath(plugin.instance)}.`
            );
          });
      }
      afterAdds = monitor.captureState();

      for (const call of connectCalls) {
        const response = await this.writeApi.getBytes(call.path, call.purpose);
        apiCalls.push(recordCall("GET", call.path, call.purpose, response));
        if (!response.ok) {
          unexpectedBehavior.push(`Connect failed: ${call.path} -> HTTP ${response.status}`);
        }
      }
      connectSucceeded = true;
      for (const call of connectCalls) {
        await monitor
          .waitFor((raw) => matchesConnectionEventFromPath(raw, call.path), 5000)
          .catch(() => {
            connectSucceeded = false;
            unexpectedBehavior.push(`Websocket did not report connect for ${call.path}.`);
          });
      }
      afterConnects = monitor.captureState();

      parameterSucceeded = true;
      for (const call of parameterCalls) {
        const payload = parseParameterPayload(call);
        if (!payload) {
          parameterSucceeded = false;
          unexpectedBehavior.push(`Parameter call was missing instance/symbol/value: ${call.path}`);
          continue;
        }
        const response = await this.writeApi.postForm(
          call.path,
          {
            instance: uiGraphRef(payload.instance),
            symbol: payload.symbol,
            value: payload.value
          },
          call.purpose
        );
        apiCalls.push(recordCall("POST", call.path, call.purpose, response));
        if (!response.ok) {
          parameterSucceeded = false;
          unexpectedBehavior.push(`Parameter set failed: ${call.path} -> HTTP ${response.status}`);
        }
      }
      afterParameters = monitor.captureState();

      await sleep(restoreAfterSeconds * 1000);

      const tempDisconnects = [...connectCalls].reverse();
      tempDisconnectSucceeded = true;
      for (const call of tempDisconnects) {
        const path = this.disconnectPathFromConnectPath(call.path);
        const response = await this.writeApi.getBytes(path, `rollback ${call.path}`);
        apiCalls.push(recordCall("GET", path, `rollback ${call.path}`, response));
        if (!response.ok) {
          tempDisconnectSucceeded = false;
          unexpectedBehavior.push(`Rollback disconnect failed: ${path} -> HTTP ${response.status}`);
        }
      }

      for (const call of tempDisconnects) {
        const target = parseConnectPath(call.path);
        if (!target) continue;
        await monitor
          .waitFor(
            (raw) => matchesConnectionEvent(raw, "disconnect", target.source, target.target),
            5000
          )
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report rollback disconnect for ${target.source} -> ${target.target}.`
            );
          });
      }

      const removePath = this.removePath(plugin.instance);
      const removeResponse = await this.writeApi.getBytes(
        removePath,
        "rollback remove live plugin"
      );
      apiCalls.push(recordCall("GET", removePath, "rollback remove live plugin", removeResponse));
      removeSucceeded = removeResponse.ok;
      if (!removeResponse.ok) {
        unexpectedBehavior.push(`Remove failed: ${removePath} -> HTTP ${removeResponse.status}`);
      } else {
        await monitor
          .waitFor((raw) => matchesInstanceEvent(raw, "remove", plugin.instance), 5000)
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report remove for ${uiGraphInstancePath(plugin.instance)}.`
            );
          });
      }

      restoreSucceeded = true;
      for (const edge of occupiedBaselineEdges) {
        const path = this.connectPath(edge.source, edge.target);
        const response = await this.writeApi.getBytes(
          path,
          `restore ${edge.source} -> ${edge.target}`
        );
        apiCalls.push(
          recordCall("GET", path, `restore ${edge.source} -> ${edge.target}`, response)
        );
        if (!response.ok) {
          restoreSucceeded = false;
          unexpectedBehavior.push(`Restore connect failed: ${path} -> HTTP ${response.status}`);
        }
      }

      for (const edge of occupiedBaselineEdges) {
        await monitor
          .waitFor((raw) => matchesConnectionEvent(raw, "connect", edge.source, edge.target), 5000)
          .catch(() => {
            unexpectedBehavior.push(
              `Websocket did not report restore connect for ${edge.source} -> ${edge.target}.`
            );
          });
      }
      afterRollback = monitor.captureState();

      const final = afterRollback;
      const finalMatchesBaseline = graphStateEquals(baseline, final);
      if (!finalMatchesBaseline) {
        unexpectedBehavior.push("Final websocket graph did not match the baseline graph.");
      }

      const success =
        unexpectedBehavior.length === 0 &&
        baselineDisconnected &&
        addSucceeded &&
        connectSucceeded &&
        parameterSucceeded &&
        tempDisconnectSucceeded &&
        removeSucceeded &&
        restoreSucceeded &&
        finalMatchesBaseline;

      return {
        dryRun: false,
        mode: input.mode,
        confirmed: true,
        restoreAfterSeconds,
        supportedTopology,
        plan: input.plan,
        websocket: buildWebsocketState(
          this.websocketUrl,
          monitor.rawMessages(),
          baseline,
          afterDisconnects,
          afterAdds,
          afterConnects,
          afterParameters,
          afterRollback,
          plugin.instance
        ),
        apiCalls,
        success,
        unexpectedBehavior,
        notes: [
          "Temporary live graph apply only; no pedalboard save or bank save was attempted.",
          "Rollback was attempted after the restore delay even on failure."
        ]
      };
    } finally {
      if (
        input.mode === "apply_temporary" &&
        !restoreSucceeded &&
        (addSucceeded || baselineDisconnected || tempDisconnectSucceeded)
      ) {
        await bestEffortCleanup(
          this.writeApi,
          apiCalls,
          connectCalls,
          occupiedBaselineEdges,
          plugin.instance
        );
      }
      await monitor.close();
    }
  }

  private dryRunResult(
    input: {
      mode: "dry_run" | "apply_temporary";
      confirm: boolean;
      restoreAfterSeconds?: number;
      plan: LiveGraphBuilderPlan;
    },
    restoreAfterSeconds: number,
    analysis: {
      supported: true;
      addCall: LiveGraphApiCall;
      connectCalls: LiveGraphApiCall[];
      parameterCalls: LiveGraphApiCall[];
    }
  ): LiveGraphBuilderResult {
    const apiCalls = [
      {
        method: "GET" as const,
        path: analysis.addCall.path,
        purpose: analysis.addCall.purpose,
        status: "success" as const,
        httpStatus: 200
      },
      ...analysis.connectCalls.map((call) => ({
        method: "GET" as const,
        path: call.path,
        purpose: call.purpose,
        status: "success" as const,
        httpStatus: 200
      })),
      ...analysis.parameterCalls.map((call) => ({
        method: "POST" as const,
        path: call.path,
        purpose: call.purpose,
        status: "success" as const,
        httpStatus: 200
      }))
    ];

    return {
      dryRun: true,
      mode: input.mode,
      confirmed: input.confirm,
      restoreAfterSeconds,
      supportedTopology: SUPPORT_NAME,
      plan: input.plan,
      websocket: emptyWebsocketState(this.websocketUrl),
      apiCalls,
      success: true,
      unexpectedBehavior: [],
      notes: [
        "Dry-run only; no device calls were made.",
        "Planned add/connect/parameter calls use the UI-compatible /graph path format."
      ]
    };
  }

  private unsupportedResult(
    input: {
      mode: "dry_run" | "apply_temporary";
      confirm: boolean;
      restoreAfterSeconds?: number;
      plan: LiveGraphBuilderPlan;
    },
    restoreAfterSeconds: number,
    reason: string
  ): LiveGraphBuilderResult {
    return {
      dryRun: input.mode === "dry_run",
      mode: input.mode,
      confirmed: input.confirm,
      restoreAfterSeconds,
      supportedTopology: SUPPORT_NAME,
      plan: input.plan,
      websocket: emptyWebsocketState(this.websocketUrl),
      apiCalls: [],
      success: false,
      unexpectedBehavior: [reason],
      notes: ["Live graph builder v1 only supports a single stereo plugin chain."]
    };
  }

  private notAttempted(
    input: {
      mode: "dry_run" | "apply_temporary";
      confirm: boolean;
      restoreAfterSeconds?: number;
      plan: LiveGraphBuilderPlan;
    },
    restoreAfterSeconds: number,
    error: string
  ): LiveGraphBuilderResult {
    return {
      dryRun: input.mode === "dry_run",
      mode: input.mode,
      confirmed: input.confirm,
      restoreAfterSeconds,
      supportedTopology: SUPPORT_NAME,
      plan: input.plan,
      websocket: emptyWebsocketState(this.websocketUrl),
      apiCalls: [],
      success: false,
      unexpectedBehavior: [error],
      notes: ["Explicit confirmation is required for apply_temporary mode."]
    };
  }

  private analyzePlan(plan: LiveGraphBuilderPlan):
    | {
        supported: true;
        plugin: { name: string; uri: string; instance: string; x: number; y: number };
        addCall: LiveGraphApiCall;
        connectCalls: LiveGraphApiCall[];
        parameterCalls: LiveGraphApiCall[];
      }
    | { supported: false; reason: string } {
    if (plan.plugins.length !== 1) {
      return {
        supported: false,
        reason: "LiveGraphBuilderService v1 supports exactly one plugin."
      };
    }
    const plugin = plan.plugins[0];
    const addCall = plugin.addCall;
    if (!addCall.path.startsWith("/effect/add//graph/")) {
      return {
        supported: false,
        reason: `Add call must use UI-compatible /graph path format: ${addCall.path}`
      };
    }

    const connectCalls = plan.apiCalls.filter((call) => call.path.startsWith("/effect/connect/"));
    const expectedConnectPaths = [
      `/effect/connect//graph/capture_1,${uiGraphRef(`${plugin.instance}/inL`)}`,
      `/effect/connect//graph/capture_2,${uiGraphRef(`${plugin.instance}/inR`)}`,
      `/effect/connect/${uiGraphRef(`${plugin.instance}/outL`)},/graph/playback_1`,
      `/effect/connect/${uiGraphRef(`${plugin.instance}/outR`)},/graph/playback_2`
    ];
    if (connectCalls.length !== expectedConnectPaths.length) {
      return {
        supported: false,
        reason: `LiveGraphBuilderService v1 expects exactly 4 connect calls for stereo output; got ${connectCalls.length}.`
      };
    }
    const actualConnectPaths = connectCalls.map((call) => call.path);
    if (!arraysEqual(actualConnectPaths, expectedConnectPaths)) {
      return {
        supported: false,
        reason: "LiveGraphBuilderService v1 only supports the stereo linear chain topology."
      };
    }
    const parameterCalls = plan.apiCalls.filter((call) => call.path === "/effect/parameter/set/");
    return {
      supported: true,
      plugin,
      addCall,
      connectCalls,
      parameterCalls
    };
  }

  private findOccupiedEdges(
    state: LiveGraphConnectionExperimentGraphStateLike,
    connectCalls: Array<LiveGraphApiCall>
  ): Array<{ source: string; target: string }> {
    const desiredTargets = new Set(
      connectCalls.map((call) => {
        const parsed = parseConnectPath(call.path);
        return `${canonicalGraphRef(parsed?.source ?? "")}->${canonicalGraphRef(parsed?.target ?? "")}`;
      })
    );
    return state.edges.filter((edge) => {
      const source = canonicalGraphRef(edge.source);
      const target = canonicalGraphRef(edge.target);
      const key = `${source}->${target}`;
      const touchesCapture = source === "capture_1" || source === "capture_2";
      const touchesPlayback = target === "playback_1" || target === "playback_2";
      return (touchesCapture || touchesPlayback) && !desiredTargets.has(key);
    });
  }

  private disconnectPath(source: string, target: string): string {
    return `/effect/disconnect/${uiGraphRef(source)},${uiGraphRef(target)}`;
  }

  private disconnectPathFromConnectPath(connectPath: string): string {
    const parsed = parseConnectPath(connectPath);
    if (!parsed) return connectPath.replace("/effect/connect/", "/effect/disconnect/");
    return this.disconnectPath(parsed.source, parsed.target);
  }

  private connectPath(source: string, target: string): string {
    return `/effect/connect/${uiGraphRef(source)},${uiGraphRef(target)}`;
  }

  private removePath(instance: string): string {
    return `/effect/remove/${uiGraphInstancePath(instance)}`;
  }
}

interface LiveGraphConnectionExperimentGraphStateLike {
  nodes: Array<{ instance: string; uri: string }>;
  edges: Array<{ source: string; target: string }>;
}

function parseConnectPath(connectPath: string): { source: string; target: string } | null {
  const prefix = "/effect/connect/";
  if (!connectPath.startsWith(prefix)) return null;
  const pair = connectPath.slice(prefix.length);
  const [source, target] = pair.split(",", 2);
  if (!source || !target) return null;
  return { source, target };
}

function parseParameterPayload(call: {
  body: unknown;
}): { instance: string; symbol: string; value: number } | null {
  const body = call.body as
    | { value?: { instance?: string; symbol?: string; value?: number } }
    | undefined;
  const value = body?.value;
  if (!value?.instance || !value.symbol || typeof value.value !== "number") return null;
  return {
    instance: canonicalGraphRef(value.instance),
    symbol: value.symbol,
    value: value.value
  };
}

function emptyWebsocketState(url: string): LiveGraphBuilderWebsocketState {
  const empty = emptyGraphState();
  return {
    url,
    rawMessages: [],
    addObserved: false,
    connectObserved: false,
    disconnectObserved: false,
    removeObserved: false,
    baseline: empty,
    afterDisconnects: empty,
    afterAdds: empty,
    afterConnects: empty,
    afterParameters: empty,
    afterRollback: empty,
    final: empty,
    finalMatchesBaseline: false
  };
}

function buildWebsocketState(
  url: string,
  rawMessages: string[],
  baseline: LiveGraphConnectionExperimentGraphStateLike,
  afterDisconnects: LiveGraphConnectionExperimentGraphStateLike,
  afterAdds: LiveGraphConnectionExperimentGraphStateLike,
  afterConnects: LiveGraphConnectionExperimentGraphStateLike,
  afterParameters: LiveGraphConnectionExperimentGraphStateLike,
  afterRollback: LiveGraphConnectionExperimentGraphStateLike,
  instance: string
): LiveGraphBuilderWebsocketState {
  const final = afterRollback;
  return {
    url,
    rawMessages,
    addObserved: rawMessages.some((raw) => matchesInstanceEvent(raw, "add", instance)),
    connectObserved: rawMessages.some((raw) => raw.startsWith("connect ")),
    disconnectObserved: rawMessages.some((raw) => raw.startsWith("disconnect ")),
    removeObserved: rawMessages.some((raw) => matchesInstanceEvent(raw, "remove", instance)),
    baseline,
    afterDisconnects,
    afterAdds,
    afterConnects,
    afterParameters,
    afterRollback,
    final,
    finalMatchesBaseline: graphStateEquals(baseline, final)
  };
}

function emptyGraphState(): LiveGraphConnectionExperimentGraphStateLike {
  return { nodes: [], edges: [] };
}

function graphStateEquals(
  a: LiveGraphConnectionExperimentGraphStateLike,
  b: LiveGraphConnectionExperimentGraphStateLike
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

function matchesInstanceEvent(raw: string, kind: "add" | "remove", instance: string): boolean {
  const parsed = parseGraphMessage(raw);
  return (
    parsed.type === kind && canonicalGraphRef(parsed.instance ?? "") === canonicalGraphRef(instance)
  );
}

function matchesConnectionEvent(
  raw: string,
  kind: "connect" | "disconnect",
  source: string,
  target: string
): boolean {
  const parsed = parseGraphMessage(raw);
  return (
    parsed.type === kind &&
    canonicalGraphRef(parsed.source ?? "") === canonicalGraphRef(source) &&
    canonicalGraphRef(parsed.target ?? "") === canonicalGraphRef(target)
  );
}

function matchesConnectionEventFromPath(raw: string, path: string): boolean {
  const parsedPath = parseConnectPath(path);
  if (!parsedPath) return false;
  return matchesConnectionEvent(raw, "connect", parsedPath.source, parsedPath.target);
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
  connectCalls: Array<LiveGraphApiCall>,
  occupiedBaselineEdges: Array<{ source: string; target: string }>,
  instance: string
): Promise<void> {
  for (const call of [...connectCalls].reverse()) {
    const parsed = parseConnectPath(call.path);
    const path = parsed
      ? `/effect/disconnect/${uiGraphRef(parsed.source)},${uiGraphRef(parsed.target)}`
      : call.path.replace("/effect/connect/", "/effect/disconnect/");
    try {
      const response = await writeApi.getBytes(path, "best-effort rollback disconnect");
      apiCalls.push(recordCall("GET", path, "best-effort rollback disconnect", response));
    } catch {
      // best effort only
    }
  }
  try {
    const response = await writeApi.getBytes(
      `/effect/remove/${uiGraphInstancePath(instance)}`,
      "best-effort rollback remove"
    );
    apiCalls.push(
      recordCall(
        "GET",
        `/effect/remove/${uiGraphInstancePath(instance)}`,
        "best-effort rollback remove",
        response
      )
    );
  } catch {
    // best effort only
  }
  for (const edge of occupiedBaselineEdges) {
    try {
      const response = await writeApi.getBytes(
        `/effect/connect/${uiGraphRef(edge.source)},${uiGraphRef(edge.target)}`,
        "best-effort baseline restore"
      );
      apiCalls.push(
        recordCall(
          "GET",
          `/effect/connect/${uiGraphRef(edge.source)},${uiGraphRef(edge.target)}`,
          "best-effort baseline restore",
          response
        )
      );
    } catch {
      // best effort only
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LiveGraphWebsocketMonitor {
  private readonly messages: string[] = [];
  private readonly nodes = new Map<string, string>();
  private readonly edges = new Set<string>();
  private readonly waiters: Array<{
    predicate: (message: string) => boolean;
    resolve: (message: string) => void;
  }> = [];
  private socket: LiveGraphBuilderWebSocketLike | null = null;
  private opened = false;

  private constructor(
    private readonly url: string,
    private readonly factory: LiveGraphBuilderWebSocketFactory
  ) {}

  static async open(
    url: string,
    factory: LiveGraphBuilderWebSocketFactory
  ): Promise<LiveGraphWebsocketMonitor> {
    const monitor = new LiveGraphWebsocketMonitor(url, factory);
    await monitor.open();
    return monitor;
  }

  snapshot(): LiveGraphConnectionExperimentGraphStateLike {
    return {
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

  rawMessages(): string[] {
    return [...this.messages];
  }

  captureState(): LiveGraphConnectionExperimentGraphStateLike {
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

function defaultWebSocketFactory(url: string): LiveGraphBuilderWebSocketLike {
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    throw new Error("WebSocket is not available in this runtime");
  }
  return new WebSocketCtor(url) as unknown as LiveGraphBuilderWebSocketLike;
}
