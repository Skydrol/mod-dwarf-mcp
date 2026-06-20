import type { PedalboardService } from "./pedalboardService.js";
import type { PluginService } from "./pluginService.js";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { PedalboardInspection } from "../types/pedalboard.js";
import { uiGraphInstancePath, uiGraphRef } from "./liveGraphRefs.js";

export interface GraphEditApiCall {
  path: string;
  status: "success" | "failed";
  httpStatus?: number;
}

export interface GraphEditResult {
  success: boolean;
  notes: string[];
  apiCalls: GraphEditApiCall[];
  afterState: PedalboardInspection | null;
}

// Same encoding as the global escape() used throughout the live authoring plan —
// encodes special chars but NOT forward slashes, as the MOD firmware expects.
// eslint-disable-next-line no-restricted-globals -- intentional: MOD firmware URI encoding
const legacyEscape = (s: string): string => escape(s);

export class GraphEditorService {
  constructor(
    private readonly pedalboardService: PedalboardService,
    private readonly pluginService: PluginService,
    private readonly writeApi: WriteHttpClient | null
  ) {}

  // ─── add_effect ──────────────────────────────────────────────────────────────

  async addEffect(input: {
    bundlepath: string;
    pluginUri: string;
    instanceName?: string;
    position: "first" | "last";
    confirm: boolean;
  }): Promise<GraphEditResult> {
    if (!input.confirm) return notConfirmed();
    if (!this.writeApi) return noWriteApi();

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const connections = inspection.connections;

    const ports = await this.pluginService.getPluginPorts(input.pluginUri);
    if (ports.audioInputs.length === 0 || ports.audioOutputs.length === 0) {
      return {
        success: false,
        notes: [
          `Plugin ${input.pluginUri} has no audio ports in the catalog. ` +
            "Run refresh_device_inventory if this plugin is installed but not in the catalog."
        ],
        apiCalls: [],
        afterState: null
      };
    }

    const instance = input.instanceName ?? deriveInstance(input.pluginUri, inspection.pluginsUsed);
    const calls: GraphEditApiCall[] = [];

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for editing"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    const x = input.position === "last" ? 300 + inspection.pluginsUsed.length * 200 : 100;
    const addPath = `/effect/add/${uiGraphInstancePath(instance)}?x=${x}&y=200&uri=${legacyEscape(input.pluginUri)}`;
    const addResult = await this.writeApi.getBytes(addPath, `add ${instance}`);
    calls.push(rec(addPath, addResult.ok, addResult.status));
    if (!addResult.ok) return fail(`Failed to add plugin instance ${instance}.`, calls);

    const connectNotes: string[] = [];

    if (input.position === "last") {
      // Connections going to playback ports (the current last plugin's outputs go here)
      const toPlayback = connections.filter((c) => /\/graph\/playback_\d+$/.test(c.head));
      for (const conn of toPlayback) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      // Connect previous last plugin's outputs to new plugin's inputs
      const prevTails = toPlayback.map((c) => c.tail);
      const newInputRefs = ports.audioInputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));
      for (let i = 0; i < Math.min(prevTails.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${prevTails[i]},${newInputRefs[i]}`,
          `connect ${prevTails[i]} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${prevTails[i]},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${prevTails[i]} → ${newInputRefs[i]}`);
      }
      // Connect new plugin's outputs to playback ports
      const newOutputRefs = ports.audioOutputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));
      const playbackPorts = ["/graph/playback_1", "/graph/playback_2"].slice(0, newOutputRefs.length);
      for (let i = 0; i < Math.min(newOutputRefs.length, playbackPorts.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${playbackPorts[i]}`,
          `connect ${newOutputRefs[i]} → ${playbackPorts[i]}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${playbackPorts[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${playbackPorts[i]}`);
      }
    } else {
      // "first": capture ports currently go to the first plugin — insert before it
      const fromCapture = connections.filter((c) => /\/graph\/capture_\d+$/.test(c.tail));
      for (const conn of fromCapture) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      // capture → new plugin
      const captureTails = fromCapture.map((c) => c.tail);
      const newInputRefs = ports.audioInputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));
      for (let i = 0; i < Math.min(captureTails.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${captureTails[i]},${newInputRefs[i]}`,
          `connect ${captureTails[i]} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${captureTails[i]},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${captureTails[i]} → ${newInputRefs[i]}`);
      }
      // new plugin → old first plugin inputs
      const prevFirstHeads = fromCapture.map((c) => c.head);
      const newOutputRefs = ports.audioOutputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));
      for (let i = 0; i < Math.min(newOutputRefs.length, prevFirstHeads.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${prevFirstHeads[i]}`,
          `connect ${newOutputRefs[i]} → ${prevFirstHeads[i]}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${prevFirstHeads[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${prevFirstHeads[i]}`);
      }
    }

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: inspection.title ?? "Modified Board", asNew: 0 },
      "save modified board in-place"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    const afterState = saveResult.ok
      ? await safeInspect(this.pedalboardService, input.bundlepath)
      : null;

    return {
      success: saveResult.ok,
      notes: [
        `Added ${instance} (${input.pluginUri}) at position "${input.position}".`,
        ...connectNotes,
        saveResult.ok ? "Board saved in-place." : "Board save failed."
      ],
      apiCalls: calls,
      afterState
    };
  }

  // ─── remove_effect ───────────────────────────────────────────────────────────

  async removeEffect(input: {
    bundlepath: string;
    instance: string;
    reconnect: boolean;
    confirm: boolean;
  }): Promise<GraphEditResult> {
    if (!input.confirm) return notConfirmed();
    if (!this.writeApi) return noWriteApi();

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const instanceRef = normalizeInstanceRef(input.instance);
    const exists = inspection.pluginsUsed.some(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    if (!exists) {
      const available = inspection.pluginsUsed.map((p) => normalizeInstanceRef(p.instance)).join(", ");
      return {
        success: false,
        notes: [`Instance '${input.instance}' not found on board. Available: ${available}`],
        apiCalls: [],
        afterState: null
      };
    }

    const connections = inspection.connections;
    const incomingConns = connections.filter((c) => c.head.startsWith(`${instanceRef}/`));
    const outgoingConns = connections.filter((c) => c.tail.startsWith(`${instanceRef}/`));

    const calls: GraphEditApiCall[] = [];

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for editing"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    for (const conn of [...incomingConns, ...outgoingConns]) {
      const r = await this.writeApi.getBytes(
        `/effect/disconnect/${conn.tail},${conn.head}`,
        `disconnect ${conn.tail} from ${conn.head}`
      );
      calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
    }

    const removePath = `/effect/remove/${uiGraphInstancePath(input.instance)}`;
    const removeResult = await this.writeApi.getBytes(removePath, `remove ${input.instance}`);
    calls.push(rec(removePath, removeResult.ok, removeResult.status));
    if (!removeResult.ok) return fail(`Failed to remove plugin ${input.instance}.`, calls);

    const connectNotes: string[] = [];
    if (input.reconnect) {
      const inTails = incomingConns.map((c) => c.tail);
      const outHeads = outgoingConns.map((c) => c.head);
      for (let i = 0; i < Math.min(inTails.length, outHeads.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${inTails[i]},${outHeads[i]}`,
          `bypass: ${inTails[i]} → ${outHeads[i]}`
        );
        calls.push(rec(`/effect/connect/${inTails[i]},${outHeads[i]}`, r.ok, r.status));
        connectNotes.push(`Bypass reconnected ${inTails[i]} → ${outHeads[i]}`);
      }
    }

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: inspection.title ?? "Modified Board", asNew: 0 },
      "save modified board in-place"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    const afterState = saveResult.ok
      ? await safeInspect(this.pedalboardService, input.bundlepath)
      : null;

    return {
      success: saveResult.ok,
      notes: [
        `Removed plugin ${input.instance}.`,
        ...connectNotes,
        saveResult.ok ? "Board saved in-place." : "Board save failed."
      ],
      apiCalls: calls,
      afterState
    };
  }

  // ─── replace_effect ──────────────────────────────────────────────────────────

  async replaceEffect(input: {
    bundlepath: string;
    instanceToReplace: string;
    newPluginUri: string;
    newInstanceName?: string;
    confirm: boolean;
  }): Promise<GraphEditResult> {
    if (!input.confirm) return notConfirmed();
    if (!this.writeApi) return noWriteApi();

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const instanceRef = normalizeInstanceRef(input.instanceToReplace);
    const exists = inspection.pluginsUsed.some(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    if (!exists) {
      const available = inspection.pluginsUsed.map((p) => normalizeInstanceRef(p.instance)).join(", ");
      return {
        success: false,
        notes: [`Instance '${input.instanceToReplace}' not found. Available: ${available}`],
        apiCalls: [],
        afterState: null
      };
    }

    const newPorts = await this.pluginService.getPluginPorts(input.newPluginUri);
    if (newPorts.audioInputs.length === 0 || newPorts.audioOutputs.length === 0) {
      return {
        success: false,
        notes: [`Replacement plugin ${input.newPluginUri} has no audio ports in the catalog.`],
        apiCalls: [],
        afterState: null
      };
    }

    const connections = inspection.connections;
    const incomingConns = connections.filter((c) => c.head.startsWith(`${instanceRef}/`));
    const outgoingConns = connections.filter((c) => c.tail.startsWith(`${instanceRef}/`));

    const newInstance =
      input.newInstanceName ?? deriveInstance(input.newPluginUri, inspection.pluginsUsed);
    const calls: GraphEditApiCall[] = [];

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for replacement"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    // Disconnect all connections of the old plugin
    for (const conn of [...incomingConns, ...outgoingConns]) {
      const r = await this.writeApi.getBytes(
        `/effect/disconnect/${conn.tail},${conn.head}`,
        `disconnect ${conn.tail} from ${conn.head}`
      );
      calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
    }

    // Remove old plugin
    const removePath = `/effect/remove/${uiGraphInstancePath(input.instanceToReplace)}`;
    const removeResult = await this.writeApi.getBytes(removePath, `remove ${input.instanceToReplace}`);
    calls.push(rec(removePath, removeResult.ok, removeResult.status));
    if (!removeResult.ok) return fail(`Failed to remove ${input.instanceToReplace}.`, calls);

    // Add replacement plugin at same rough position
    const replacedIndex = inspection.pluginsUsed.findIndex(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    const x = 200 + replacedIndex * 250;
    const addPath = `/effect/add/${uiGraphInstancePath(newInstance)}?x=${x}&y=200&uri=${legacyEscape(input.newPluginUri)}`;
    const addResult = await this.writeApi.getBytes(addPath, `add replacement ${newInstance}`);
    calls.push(rec(addPath, addResult.ok, addResult.status));
    if (!addResult.ok) return fail(`Failed to add replacement plugin ${newInstance}.`, calls);

    // Rewire: incoming → new plugin inputs, new plugin outputs → outgoing
    const newInputRefs = newPorts.audioInputs.map((p) => uiGraphRef(`${newInstance}/${p.symbol}`));
    const newOutputRefs = newPorts.audioOutputs.map((p) => uiGraphRef(`${newInstance}/${p.symbol}`));
    const inTails = incomingConns.map((c) => c.tail);
    const outHeads = outgoingConns.map((c) => c.head);

    for (let i = 0; i < Math.min(inTails.length, newInputRefs.length); i++) {
      const r = await this.writeApi.getBytes(
        `/effect/connect/${inTails[i]},${newInputRefs[i]}`,
        `rewire in: ${inTails[i]} → ${newInputRefs[i]}`
      );
      calls.push(rec(`/effect/connect/${inTails[i]},${newInputRefs[i]}`, r.ok, r.status));
    }
    for (let i = 0; i < Math.min(newOutputRefs.length, outHeads.length); i++) {
      const r = await this.writeApi.getBytes(
        `/effect/connect/${newOutputRefs[i]},${outHeads[i]}`,
        `rewire out: ${newOutputRefs[i]} → ${outHeads[i]}`
      );
      calls.push(rec(`/effect/connect/${newOutputRefs[i]},${outHeads[i]}`, r.ok, r.status));
    }

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: inspection.title ?? "Modified Board", asNew: 0 },
      "save modified board in-place"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    const afterState = saveResult.ok
      ? await safeInspect(this.pedalboardService, input.bundlepath)
      : null;

    return {
      success: saveResult.ok,
      notes: [
        `Replaced ${input.instanceToReplace} with ${newInstance} (${input.newPluginUri}).`,
        `Rewired ${incomingConns.length} incoming and ${outgoingConns.length} outgoing connections.`,
        saveResult.ok ? "Board saved in-place." : "Board save failed."
      ],
      apiCalls: calls,
      afterState
    };
  }

  // ─── set_effect_parameter ────────────────────────────────────────────────────

  async setEffectParameter(input: {
    bundlepath: string;
    instance: string;
    parameters: Record<string, number>;
    confirm: boolean;
  }): Promise<GraphEditResult> {
    if (!input.confirm) return notConfirmed();
    if (!this.writeApi) return noWriteApi();

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const calls: GraphEditApiCall[] = [];

    // Validate that the instance exists and resolve its URI for symbol checking.
    const instanceRef = normalizeInstanceRef(input.instance);
    const instancePlugin = inspection.pluginsUsed.find(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    if (!instancePlugin) {
      const available = inspection.pluginsUsed.map((p) => normalizeInstanceRef(p.instance)).join(", ");
      return {
        success: false,
        notes: [`Instance '${input.instance}' not found on board. Available: ${available}`],
        apiCalls: [],
        afterState: null
      };
    }

    // Validate parameter symbols before touching the device.
    const ports = await this.pluginService.getPluginPorts(instancePlugin.uri);
    const knownSymbols = new Set(ports.controlInputs.map((p) => p.symbol));
    const unknownSymbols = Object.keys(input.parameters).filter((s) => !knownSymbols.has(s));
    if (unknownSymbols.length > 0) {
      const availableList = ports.controlInputs.map(
        (p) =>
          `  ${p.symbol}` +
          (p.name && p.name !== p.symbol ? ` ("${p.name}")` : "") +
          ` — range: ${p.minimum ?? "?"}..${p.maximum ?? "?"}` +
          (p.unit ? ` ${p.unit}` : "") +
          (p.default !== undefined ? `, default: ${p.default}` : "")
      );
      return {
        success: false,
        notes: [
          `Unknown parameter symbol(s) for ${input.instance}: ${unknownSymbols.join(", ")}`,
          `Call get_plugin_parameters with uri="${instancePlugin.uri}" to see all available parameters.`,
          `Available control inputs for this plugin:`,
          ...availableList
        ],
        apiCalls: [],
        afterState: null
      };
    }

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for parameter edit"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    const paramNotes: string[] = [];
    for (const [symbol, value] of Object.entries(input.parameters)) {
      // Path format: /effect/parameter/set//graph/<Instance>/<Symbol> <value>
      const path = `/effect/parameter/set/${uiGraphRef(`${input.instance}/${symbol}`)} ${value}`;
      const r = await this.writeApi.getBytes(path, `set ${symbol}=${value} on ${input.instance}`);
      calls.push(rec(path, r.ok, r.status));
      paramNotes.push(`${symbol} = ${value} (HTTP ${r.status}${r.ok ? "" : " — failed"})`);
    }

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: inspection.title ?? "Modified Board", asNew: 0 },
      "save modified board in-place"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    // Parameter-only edit: board structure (plugins, connections) is unchanged.
    // Return the pre-edit inspection as afterState — it still reflects the current plugin
    // list and wiring, and the parameter changes are confirmed by the per-symbol HTTP status above.
    return {
      success: saveResult.ok,
      notes: [
        `Set parameters on ${input.instance}:`,
        ...paramNotes,
        saveResult.ok ? "Board saved in-place." : "Board save failed."
      ],
      apiCalls: calls,
      afterState: saveResult.ok ? inspection : null
    };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeInstanceRef(instance: string): string {
  const bare = instance.replace(/^\/graph\//, "").replace(/^\//, "");
  return `/graph/${bare}`;
}

function deriveInstance(
  uri: string,
  existing: Array<{ instance: string }>
): string {
  const lastSegment = (uri.split("/").pop() ?? "").replace(/[^a-zA-Z0-9]/g, "") || "plugin";
  const existingNames = new Set(
    existing.map((p) => p.instance.replace(/^\/graph\//, "").replace(/^\//, ""))
  );
  if (!existingNames.has(lastSegment)) return lastSegment;
  for (let i = 2; i < 100; i++) {
    const candidate = `${lastSegment}_${i}`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${lastSegment}_${Date.now()}`;
}

function rec(path: string, ok: boolean, httpStatus?: number): GraphEditApiCall {
  return { path, status: ok ? "success" : "failed", httpStatus };
}

async function safeInspect(
  pedalboardService: PedalboardService,
  bundlepath: string
): Promise<PedalboardInspection | null> {
  try {
    return await pedalboardService.inspectPedalboard(bundlepath);
  } catch {
    return null;
  }
}

function fail(message: string, calls: GraphEditApiCall[]): GraphEditResult {
  return { success: false, notes: [message], apiCalls: calls, afterState: null };
}

function notConfirmed(): GraphEditResult {
  return {
    success: false,
    notes: ["confirm must be true to execute graph edits."],
    apiCalls: [],
    afterState: null
  };
}

function noWriteApi(): GraphEditResult {
  return {
    success: false,
    notes: ["Write API not configured. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true."],
    apiCalls: [],
    afterState: null
  };
}
