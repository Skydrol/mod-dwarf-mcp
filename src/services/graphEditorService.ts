import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import type { PedalboardService } from "./pedalboardService.js";
import type { PluginService } from "./pluginService.js";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { SshClient } from "../clients/sshClient.js";
import type { PedalboardInspection } from "../types/pedalboard.js";
import { uiGraphInstancePath, uiGraphRef } from "./liveGraphRefs.js";
import { makeTarGz } from "../utils/tarGz.js";

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

export interface BypassResult {
  success: boolean;
  unsupported: boolean;
  notes: string[];
  instance: string;
  bypassed: boolean;
  persisted: boolean;
  afterState: PedalboardInspection | null;
}

export interface SnapshotActivateResult {
  success: boolean;
  notes: string[];
  snapshotName: string;
  afterState: PedalboardInspection | null;
}

export interface DuplicateBoardResult {
  success: boolean;
  notes: string[];
  newTitle?: string;
  newBundlePath?: string;
  apiCalls: GraphEditApiCall[];
}

export interface AudioPathValidationResult {
  bundlepath: string;
  valid: boolean;
  broken: boolean;
  path: string[];
  hasCapture: boolean;
  hasPlayback: boolean;
  reachesPlayback: boolean;
  chainPlugins: string[];
  orphanPlugins: string[];
  notes: string[];
  inspection: PedalboardInspection;
}

// Same encoding as the global escape() used throughout the live authoring plan —
// encodes special chars but NOT forward slashes, as the MOD firmware expects.
// eslint-disable-next-line no-restricted-globals -- intentional: MOD firmware URI encoding
const legacyEscape = (s: string): string => escape(s);

export class GraphEditorService {
  constructor(
    private readonly pedalboardService: PedalboardService,
    private readonly pluginService: PluginService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly sshClient: SshClient | null = null
  ) {}

  // ─── add_effect ──────────────────────────────────────────────────────────────

  async addEffect(input: {
    bundlepath: string;
    pluginUri: string;
    instanceName?: string;
    position: string;
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

    const parsed = parseAddPosition(input.position);

    if ((parsed.type === "after" || parsed.type === "before")) {
      const refInstance = parsed.instance;
      const exists = inspection.pluginsUsed.some(
        (p) => normalizeInstanceRef(p.instance) === refInstance
      );
      if (!exists) {
        const available = inspection.pluginsUsed.map((p) => normalizeInstanceRef(p.instance)).join(", ");
        return {
          success: false,
          notes: [`Reference instance '${parsed.instance}' not found on board. Available: ${available}`],
          apiCalls: [],
          afterState: null
        };
      }
    }

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for editing"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    const x = parsed.type === "last" ? 300 + inspection.pluginsUsed.length * 200 : 100;
    const addPath = `/effect/add/${uiGraphInstancePath(instance)}?x=${x}&y=200&uri=${legacyEscape(input.pluginUri)}`;
    const addResult = await this.writeApi.getBytes(addPath, `add ${instance}`);
    calls.push(rec(addPath, addResult.ok, addResult.status));
    if (!addResult.ok) return fail(`Failed to add plugin instance ${instance}.`, calls);

    const connectNotes: string[] = [];
    const newInputRefs = ports.audioInputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));
    const newOutputRefs = ports.audioOutputs.map((p) => uiGraphRef(`${instance}/${p.symbol}`));

    if (parsed.type === "last") {
      const toPlayback = connections.filter((c) => /\/graph\/playback_\d+$/.test(c.head));
      for (const conn of toPlayback) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      const prevTails = toPlayback.map((c) => c.tail);
      for (let i = 0; i < Math.min(prevTails.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${prevTails[i]},${newInputRefs[i]}`,
          `connect ${prevTails[i]} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${prevTails[i]},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${prevTails[i]} → ${newInputRefs[i]}`);
      }
      const playbackPorts = ["/graph/playback_1", "/graph/playback_2"].slice(0, newOutputRefs.length);
      for (let i = 0; i < Math.min(newOutputRefs.length, playbackPorts.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${playbackPorts[i]}`,
          `connect ${newOutputRefs[i]} → ${playbackPorts[i]}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${playbackPorts[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${playbackPorts[i]}`);
      }
    } else if (parsed.type === "first") {
      const fromCapture = connections.filter((c) => /\/graph\/capture_\d+$/.test(c.tail));
      for (const conn of fromCapture) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      const captureTails = fromCapture.map((c) => c.tail);
      for (let i = 0; i < Math.min(captureTails.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${captureTails[i]},${newInputRefs[i]}`,
          `connect ${captureTails[i]} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${captureTails[i]},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${captureTails[i]} → ${newInputRefs[i]}`);
      }
      const prevFirstHeads = fromCapture.map((c) => c.head);
      for (let i = 0; i < Math.min(newOutputRefs.length, prevFirstHeads.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${prevFirstHeads[i]}`,
          `connect ${newOutputRefs[i]} → ${prevFirstHeads[i]}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${prevFirstHeads[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${prevFirstHeads[i]}`);
      }
    } else if (parsed.type === "after") {
      const refInstance = parsed.instance;
      const toNext = connections.filter((c) => c.tail.startsWith(`${refInstance}/`));
      for (const conn of toNext) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      for (let i = 0; i < Math.min(toNext.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${toNext[i].tail},${newInputRefs[i]}`,
          `connect ${toNext[i].tail} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${toNext[i].tail},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${toNext[i].tail} → ${newInputRefs[i]}`);
      }
      for (let i = 0; i < Math.min(newOutputRefs.length, toNext.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${toNext[i].head}`,
          `connect ${newOutputRefs[i]} → ${toNext[i].head}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${toNext[i].head}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${toNext[i].head}`);
      }
    } else {
      const refInstance = (parsed as { type: "before"; instance: string }).instance;
      const fromPrev = connections.filter((c) => c.head.startsWith(`${refInstance}/`));
      for (const conn of fromPrev) {
        const r = await this.writeApi.getBytes(
          `/effect/disconnect/${conn.tail},${conn.head}`,
          `disconnect ${conn.tail} from ${conn.head}`
        );
        calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
      }
      for (let i = 0; i < Math.min(fromPrev.length, newInputRefs.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${fromPrev[i].tail},${newInputRefs[i]}`,
          `connect ${fromPrev[i].tail} → ${newInputRefs[i]}`
        );
        calls.push(rec(`/effect/connect/${fromPrev[i].tail},${newInputRefs[i]}`, r.ok, r.status));
        connectNotes.push(`Connected ${fromPrev[i].tail} → ${newInputRefs[i]}`);
      }
      for (let i = 0; i < Math.min(newOutputRefs.length, fromPrev.length); i++) {
        const r = await this.writeApi.getBytes(
          `/effect/connect/${newOutputRefs[i]},${fromPrev[i].head}`,
          `connect ${newOutputRefs[i]} → ${fromPrev[i].head}`
        );
        calls.push(rec(`/effect/connect/${newOutputRefs[i]},${fromPrev[i].head}`, r.ok, r.status));
        connectNotes.push(`Connected ${newOutputRefs[i]} → ${fromPrev[i].head}`);
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

    const hadIncoming = incomingConns.length > 0;
    const hadOutgoing = outgoingConns.length > 0;

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

    for (const conn of [...incomingConns, ...outgoingConns]) {
      const r = await this.writeApi.getBytes(
        `/effect/disconnect/${conn.tail},${conn.head}`,
        `disconnect ${conn.tail} from ${conn.head}`
      );
      calls.push(rec(`/effect/disconnect/${conn.tail},${conn.head}`, r.ok, r.status));
    }

    const removePath = `/effect/remove/${uiGraphInstancePath(input.instanceToReplace)}`;
    const removeResult = await this.writeApi.getBytes(removePath, `remove ${input.instanceToReplace}`);
    calls.push(rec(removePath, removeResult.ok, removeResult.status));
    if (!removeResult.ok) return fail(`Failed to remove ${input.instanceToReplace}.`, calls);

    const replacedIndex = inspection.pluginsUsed.findIndex(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    const x = 200 + replacedIndex * 250;
    const addPath = `/effect/add/${uiGraphInstancePath(newInstance)}?x=${x}&y=200&uri=${legacyEscape(input.newPluginUri)}`;
    const addResult = await this.writeApi.getBytes(addPath, `add replacement ${newInstance}`);
    calls.push(rec(addPath, addResult.ok, addResult.status));
    if (!addResult.ok) return fail(`Failed to add replacement plugin ${newInstance}.`, calls);

    const newInputRefs = newPorts.audioInputs.map((p) => uiGraphRef(`${newInstance}/${p.symbol}`));
    const newOutputRefs = newPorts.audioOutputs.map((p) => uiGraphRef(`${newInstance}/${p.symbol}`));
    const inTails = incomingConns.map((c) => c.tail);
    const outHeads = outgoingConns.map((c) => c.head);

    let rewiredIn = 0;
    let rewiredOut = 0;

    for (let i = 0; i < Math.min(inTails.length, newInputRefs.length); i++) {
      const r = await this.writeApi.getBytes(
        `/effect/connect/${inTails[i]},${newInputRefs[i]}`,
        `rewire in: ${inTails[i]} → ${newInputRefs[i]}`
      );
      calls.push(rec(`/effect/connect/${inTails[i]},${newInputRefs[i]}`, r.ok, r.status));
      if (r.ok) rewiredIn++;
    }
    for (let i = 0; i < Math.min(newOutputRefs.length, outHeads.length); i++) {
      const r = await this.writeApi.getBytes(
        `/effect/connect/${newOutputRefs[i]},${outHeads[i]}`,
        `rewire out: ${newOutputRefs[i]} → ${outHeads[i]}`
      );
      calls.push(rec(`/effect/connect/${newOutputRefs[i]},${outHeads[i]}`, r.ok, r.status));
      if (r.ok) rewiredOut++;
    }

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: inspection.title ?? "Modified Board", asNew: 0 },
      "save modified board in-place"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    if ((hadIncoming || hadOutgoing) && rewiredIn === 0 && rewiredOut === 0) {
      const afterState = await safeInspect(this.pedalboardService, input.bundlepath);
      return {
        success: false,
        notes: [
          `AUDIO PATH BROKEN: replaced ${input.instanceToReplace} with ${newInstance} but rewired 0 incoming and 0 outgoing connections.`,
          `The old plugin had ${incomingConns.length} incoming and ${outgoingConns.length} outgoing connections recorded in the bundle, but none were successfully reconnected.`,
          `Call validate_current_board_audio_path to inspect the current state, then manually repair with add_effect or replace_effect with explicit connections.`
        ],
        apiCalls: calls,
        afterState
      };
    }

    const afterState = saveResult.ok
      ? await safeInspect(this.pedalboardService, input.bundlepath)
      : null;

    return {
      success: saveResult.ok,
      notes: [
        `Replaced ${input.instanceToReplace} with ${newInstance} (${input.newPluginUri}).`,
        `Rewired ${rewiredIn} incoming and ${rewiredOut} outgoing connections.`,
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

  // ─── toggle_effect_bypass ────────────────────────────────────────────────────

  async toggleEffectBypass(input: {
    bundlepath: string;
    instance: string;
    bypassed: boolean;
    persist: boolean;
    confirm: boolean;
  }): Promise<BypassResult> {
    if (!input.confirm)
      return { success: false, unsupported: false, notes: ["confirm must be true to execute bypass toggle."], instance: input.instance, bypassed: input.bypassed, persisted: false, afterState: null };
    if (!this.writeApi)
      return { success: false, unsupported: false, notes: ["Write API not configured. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true."], instance: input.instance, bypassed: input.bypassed, persisted: false, afterState: null };

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const instanceRef = normalizeInstanceRef(input.instance);
    const exists = inspection.pluginsUsed.some(
      (p) => normalizeInstanceRef(p.instance) === instanceRef
    );
    if (!exists) {
      const available = inspection.pluginsUsed.map((p) => normalizeInstanceRef(p.instance)).join(", ");
      return { success: false, unsupported: false, notes: [`Instance '${input.instance}' not found. Available: ${available}`], instance: input.instance, bypassed: input.bypassed, persisted: false, afterState: null };
    }

    const calls: GraphEditApiCall[] = [];

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for bypass toggle"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return { success: false, unsupported: false, notes: ["Failed to load bundle."], instance: input.instance, bypassed: input.bypassed, persisted: false, afterState: null };

    const bypassPath = `/effect/bypass/${uiGraphInstancePath(input.instance)} ${input.bypassed ? "true" : "false"}`;
    const bypassResult = await this.writeApi.getBytes(bypassPath, `bypass ${input.instance}: ${input.bypassed}`);
    calls.push(rec(bypassPath, bypassResult.ok, bypassResult.status));

    if (bypassResult.status === 404 || bypassResult.status === 405) {
      return {
        success: false,
        unsupported: true,
        notes: [
          `Bypass endpoint not supported on this firmware (HTTP ${bypassResult.status}): ${bypassPath}`,
          `The MOD Dwarf on this firmware version does not expose an HTTP bypass toggle.`,
          `Alternatives: (1) Use activate_snapshot to switch between snapshots with different parameter states. (2) Use set_effect_parameter to approximate off-state by setting the plugin's wet/mix/drive parameters to minimum — this is NOT true bypass; signal processing still runs.`,
          `Real bypass (the LED button on the device) can only be toggled via the MOD web UI or WebSocket protocol, not via HTTP on this firmware.`
        ],
        instance: input.instance,
        bypassed: input.bypassed,
        persisted: false,
        afterState: null
      };
    }

    let persisted = false;
    if (input.persist && bypassResult.ok) {
      const saveResult = await this.writeApi.postForm(
        "/pedalboard/save",
        { title: inspection.title ?? "Modified Board", asNew: 0 },
        "persist bypass state"
      );
      calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));
      persisted = saveResult.ok;
    }

    const afterState = bypassResult.ok ? await safeInspect(this.pedalboardService, input.bundlepath) : null;

    return {
      success: bypassResult.ok,
      unsupported: false,
      notes: [
        bypassResult.ok
          ? `${input.instance} is now ${input.bypassed ? "bypassed" : "active"}.`
          : `Bypass toggle failed (HTTP ${bypassResult.status}).`,
        input.persist
          ? persisted ? "Bypass state saved to bundle." : "Warning: bypass state NOT saved (save failed)."
          : "Bypass is live only — call with persist=true to save to bundle."
      ],
      instance: input.instance,
      bypassed: input.bypassed,
      persisted,
      afterState
    };
  }

  // ─── activate_snapshot ───────────────────────────────────────────────────────

  async activateSnapshot(input: {
    bundlepath: string;
    snapshotName: string;
    confirm: boolean;
  }): Promise<SnapshotActivateResult> {
    if (!input.confirm)
      return { success: false, notes: ["confirm must be true to activate a snapshot."], snapshotName: input.snapshotName, afterState: null };
    if (!this.writeApi)
      return { success: false, notes: ["Write API not configured."], snapshotName: input.snapshotName, afterState: null };

    const inspection = await this.pedalboardService.inspectPedalboard(input.bundlepath);
    const snapshot = inspection.snapshots.find(
      (s) => s.name.toLowerCase() === input.snapshotName.toLowerCase()
    );
    if (!snapshot) {
      const available = inspection.snapshots.map((s) => s.name).join(", ");
      return { success: false, notes: [`Snapshot '${input.snapshotName}' not found. Available: ${available || "(none)"}`], snapshotName: input.snapshotName, afterState: null };
    }

    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: input.bundlepath },
      "load bundle for snapshot activation"
    );
    if (!loadResult.ok)
      return { success: false, notes: ["Failed to load bundle."], snapshotName: input.snapshotName, afterState: null };

    const encoded = encodeURIComponent(snapshot.name);
    const snapPath = `/snapshot/load?name=${encoded}`;
    const snapResult = await this.writeApi.getBytes(snapPath, `activate snapshot "${snapshot.name}"`);

    const afterState = snapResult.ok ? inspection : null;

    return {
      success: snapResult.ok,
      notes: [
        snapResult.ok
          ? `Snapshot "${snapshot.name}" activated.`
          : `Snapshot activation failed (HTTP ${snapResult.status}). The endpoint /snapshot/load?name=<name> may differ on this firmware — check the device documentation.`
      ],
      snapshotName: snapshot.name,
      afterState
    };
  }

  // ─── duplicate_board ─────────────────────────────────────────────────────────

  async duplicateBoard(input: {
    sourceBundlePath: string;
    newTitle: string;
    confirm: boolean;
  }): Promise<DuplicateBoardResult> {
    if (!input.confirm)
      return { success: false, notes: ["confirm must be true to duplicate a board."], apiCalls: [] };
    if (!this.writeApi)
      return { success: false, notes: ["Write API not configured."], apiCalls: [] };

    const rawFiles = await this.pedalboardService.readBundleFiles(input.sourceBundlePath);
    if (!rawFiles.manifestText || !rawFiles.mainTtlText) {
      return { success: false, notes: ["Could not read source bundle files."], apiCalls: [] };
    }

    const escapedTitle = input.newTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const newManifest = rawFiles.manifestText.replace(
      /doap:name\s+"[^"]*"/,
      `doap:name "${escapedTitle}"`
    );
    const newMainTtl = rawFiles.mainTtlText.replace(
      /doap:name\s+"[^"]*"/,
      `doap:name "${escapedTitle}"`
    );

    const slug = input.newTitle
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pedalboard";
    const newFolderName = `${slug}.pedalboard`;
    const mainTtlFileName = rawFiles.mainTtlFileName ?? `${slug}.ttl`;

    const tempDir = join(tmpdir(), `mod-dwarf-mcp-dup-${Date.now()}`);
    await mkdir(join(tempDir, newFolderName), { recursive: true });

    const tarFiles: Array<{ name: string; data: Buffer }> = [
      { name: `${newFolderName}/manifest.ttl`, data: Buffer.from(newManifest, "utf8") },
      { name: `${newFolderName}/${mainTtlFileName}`, data: Buffer.from(newMainTtl, "utf8") }
    ];
    if (rawFiles.snapshotsText) {
      tarFiles.push({ name: `${newFolderName}/snapshots.json`, data: Buffer.from(rawFiles.snapshotsText, "utf8") });
    }
    if (rawFiles.addressingsText) {
      tarFiles.push({ name: `${newFolderName}/addressings.json`, data: Buffer.from(rawFiles.addressingsText, "utf8") });
    }

    const archivePath = join(tempDir, `${newFolderName}.tar.gz`);
    await writeFile(archivePath, makeTarGz(tarFiles));

    const calls: GraphEditApiCall[] = [];

    const importResult = await this.writeApi.postRawFile(
      "/pedalboard/load_web/",
      archivePath,
      "import duplicated bundle"
    );
    calls.push(rec("/pedalboard/load_web/", importResult.ok, importResult.status));
    if (!importResult.ok)
      return { success: false, notes: [`Import failed: HTTP ${importResult.status}`], apiCalls: calls };

    const tmpBundlePath = `/tmp/pedalboards/${newFolderName}`;
    const loadResult = await this.writeApi.postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: tmpBundlePath },
      "activate imported duplicate"
    );
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok)
      return { success: false, notes: ["Duplicate imported but failed to activate."], apiCalls: calls };

    const saveResult = await this.writeApi.postForm(
      "/pedalboard/save",
      { title: input.newTitle, asNew: 1 },
      "save duplicate as new board"
    );
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    const newBundlePath = `/root/.pedalboards/${newFolderName}`;
    return {
      success: saveResult.ok,
      notes: saveResult.ok
        ? [`Board duplicated as "${input.newTitle}".`, `New bundle: ${newBundlePath}`]
        : ["Duplicate activated but final save failed."],
      newTitle: saveResult.ok ? input.newTitle : undefined,
      newBundlePath: saveResult.ok ? newBundlePath : undefined,
      apiCalls: calls
    };
  }

  // ─── validate_audio_path ─────────────────────────────────────────────────────

  async validateAudioPath(bundlepath: string): Promise<AudioPathValidationResult> {
    const inspection = await this.pedalboardService.inspectPedalboard(bundlepath);
    const connections = inspection.connections;
    const plugins = inspection.pluginsUsed;

    const captureRe = /^\/graph\/capture_\d+$/;
    const playbackRe = /^\/graph\/playback_\d+$/;

    const pluginInstances = new Set(plugins.map(p => normalizeInstanceRef(p.instance)));

    function nodeOf(portRef: string): string {
      if (portRef.startsWith("/graph/")) {
        const parts = portRef.split("/");
        return parts.length <= 3 ? portRef : `/${parts[1]}/${parts[2]}`;
      }
      const slashIdx = portRef.indexOf("/");
      const bare = slashIdx === -1 ? portRef : portRef.substring(0, slashIdx);
      return `/graph/${bare}`;
    }

    const edges = new Map<string, Set<string>>();
    for (const conn of connections) {
      const from = nodeOf(conn.tail);
      const to = nodeOf(conn.head);
      if (!edges.has(from)) edges.set(from, new Set());
      edges.get(from)!.add(to);
    }

    const captureNodes = [...new Set(connections.map(c => nodeOf(c.tail)).filter(n => captureRe.test(n)))];
    const visited = new Set<string>(captureNodes);
    const queue = [...captureNodes];
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const next of edges.get(node) ?? []) {
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }

    const playbackNodes = [...new Set(connections.map(c => nodeOf(c.head)).filter(n => playbackRe.test(n)))];
    const hasCapture = captureNodes.length > 0;
    const hasPlayback = playbackNodes.length > 0;
    const reachesPlayback = playbackNodes.some(p => visited.has(p));

    const chainPlugins = plugins.map(p => normalizeInstanceRef(p.instance)).filter(i => visited.has(i));
    const orphanPlugins = plugins.map(p => normalizeInstanceRef(p.instance)).filter(i => !visited.has(i));

    const notes: string[] = [];
    if (!hasCapture) notes.push("No capture (hardware input) ports found in connections.");
    if (!hasPlayback) notes.push("No playback (hardware output) ports found in connections.");
    if (!reachesPlayback) notes.push("Audio does not reach playback ports — signal chain is broken.");
    if (orphanPlugins.length > 0) notes.push(`Orphan plugins (not in audio path): ${orphanPlugins.join(", ")}`);
    if (reachesPlayback && orphanPlugins.length === 0) notes.push("Audio path is valid: all plugins are connected capture → playback.");

    return {
      bundlepath,
      valid: reachesPlayback && orphanPlugins.length === 0,
      broken: !reachesPlayback || orphanPlugins.length > 0,
      path: chainPlugins,
      hasCapture,
      hasPlayback,
      reachesPlayback,
      chainPlugins,
      orphanPlugins,
      notes,
      inspection
    };
  }

  // ─── remove_orphan_effects ───────────────────────────────────────────────────

  async removeOrphanEffects(input: {
    bundlepath: string;
    confirm: boolean;
  }): Promise<GraphEditResult> {
    if (!input.confirm) return notConfirmed();
    if (!this.writeApi) return noWriteApi();

    const validation = await this.validateAudioPath(input.bundlepath);
    if (validation.orphanPlugins.length === 0) {
      return {
        success: true,
        notes: ["No orphan plugins found. Audio path is valid."],
        apiCalls: [],
        afterState: validation.inspection
      };
    }

    const calls: GraphEditApiCall[] = [];
    const loadResult = await this.writeApi.postForm("/pedalboard/load_bundle/", { bundlepath: input.bundlepath }, "load bundle for orphan removal");
    calls.push(rec("/pedalboard/load_bundle/", loadResult.ok, loadResult.status));
    if (!loadResult.ok) return fail("Failed to load bundle.", calls);

    for (const orphan of validation.orphanPlugins) {
      const removePath = `/effect/remove/${uiGraphInstancePath(orphan)}`;
      const r = await this.writeApi.getBytes(removePath, `remove orphan ${orphan}`);
      calls.push(rec(removePath, r.ok, r.status));
    }

    const saveResult = await this.writeApi.postForm("/pedalboard/save", { title: validation.inspection.title ?? "Modified Board", asNew: 0 }, "save after orphan removal");
    calls.push(rec("/pedalboard/save", saveResult.ok, saveResult.status));

    const afterState = saveResult.ok ? await safeInspect(this.pedalboardService, input.bundlepath) : null;
    return {
      success: saveResult.ok,
      notes: [
        `Removed ${validation.orphanPlugins.length} orphan plugin(s): ${validation.orphanPlugins.join(", ")}`,
        saveResult.ok ? "Board saved in-place." : "Save failed."
      ],
      apiCalls: calls,
      afterState
    };
  }

  // ─── cleanup_snapshot_references ─────────────────────────────────────────────

  async cleanupSnapshotReferences(input: {
    bundlepath: string;
    removedInstance: string;
    confirm: boolean;
  }): Promise<{ success: boolean; notes: string[]; snapshotsUpdated: boolean }> {
    if (!input.confirm) return { success: false, notes: ["confirm must be true."], snapshotsUpdated: false };
    if (!this.sshClient) return { success: false, notes: ["SSH not configured."], snapshotsUpdated: false };

    const rawFiles = await this.pedalboardService.readBundleFiles(input.bundlepath);
    if (!rawFiles.snapshotsText) {
      return { success: true, notes: ["No snapshots.json found — nothing to clean."], snapshotsUpdated: false };
    }

    let snapshots: unknown;
    try {
      snapshots = JSON.parse(rawFiles.snapshotsText);
    } catch {
      return { success: false, notes: ["Could not parse snapshots.json."], snapshotsUpdated: false };
    }

    const bare = input.removedInstance.replace(/^\/graph\//, "").replace(/^\//, "");
    const refPatterns = [bare, `/graph/${bare}`, `/${bare}`];

    function removeInstanceRefs(obj: unknown): unknown {
      if (Array.isArray(obj)) return obj.map(removeInstanceRefs);
      if (obj && typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (refPatterns.some(p => k === p)) continue;
          result[k] = removeInstanceRefs(v);
        }
        return result;
      }
      return obj;
    }

    const cleaned = removeInstanceRefs(snapshots);
    const newText = JSON.stringify(cleaned, null, 2);

    if (newText === rawFiles.snapshotsText) {
      return { success: true, notes: [`No references to ${input.removedInstance} found in snapshots.json.`], snapshotsUpdated: false };
    }

    try {
      await this.sshClient.sshWriteFile(`${input.bundlepath}/snapshots.json`, newText);
      return { success: true, notes: [`Removed references to ${input.removedInstance} from snapshots.json.`], snapshotsUpdated: true };
    } catch (err) {
      return { success: false, notes: [`SSH write failed: ${err instanceof Error ? err.message : String(err)}`], snapshotsUpdated: false };
    }
  }

  // ─── check_bypass_support ────────────────────────────────────────────────────

  async checkBypassSupport(): Promise<{ supported: boolean; notes: string[]; probeResult: { httpStatus: number; path: string } | null }> {
    if (!this.writeApi) {
      return { supported: false, notes: ["Write API not configured."], probeResult: null };
    }
    const probePath = `/effect/bypass//graph/__bypass_probe__ true`;
    const result = await this.writeApi.getBytes(probePath, "probe bypass endpoint support");
    if (result.status === 404 || result.status === 405) {
      return {
        supported: false,
        notes: [`HTTP bypass endpoint not supported on this firmware (HTTP ${result.status}). Use snapshot-based parameter switching instead.`],
        probeResult: { httpStatus: result.status, path: probePath }
      };
    }
    return {
      supported: true,
      notes: [`HTTP bypass endpoint responded with HTTP ${result.status} — endpoint exists.`],
      probeResult: { httpStatus: result.status, path: probePath }
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

function parseAddPosition(position: string):
  | { type: "first" | "last" }
  | { type: "after" | "before"; instance: string } {
  if (position === "first") return { type: "first" };
  if (position === "last") return { type: "last" };
  const afterMatch = /^after:(.+)$/.exec(position);
  if (afterMatch) return { type: "after", instance: normalizeInstanceRef(afterMatch[1].trim()) };
  const beforeMatch = /^before:(.+)$/.exec(position);
  if (beforeMatch) return { type: "before", instance: normalizeInstanceRef(beforeMatch[1].trim()) };
  return { type: "last" };
}
