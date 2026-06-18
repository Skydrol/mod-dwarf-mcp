import type { PluginService } from "./pluginService.js";
import { LiveParameterService } from "./liveParameterService.js";
import { GraphLayoutService } from "./graphLayoutService.js";
import type { PedalboardPlan, PlannedPlugin } from "../types/plan.js";
import type {
  LiveGraphApiCall,
  LiveGraphAuthoringPlan,
  LiveGraphAuthoringValidation,
  LiveGraphParameterPlan,
  LiveGraphPluginPlan
} from "../types/liveGraphAuthoringPlan.js";
import type { PluginPortInfo } from "../types/plugin.js";
import type { GraphLayoutPlacement } from "./graphLayoutService.js";
import { uiGraphInstancePath } from "./liveGraphRefs.js";

interface ResolvedPlugin {
  plan: PlannedPlugin;
  ports: PluginPortInfo;
  controlRanges: LiveGraphParameterPlan[];
}

export class LiveGraphAuthoringPlanService {
  private readonly portCache = new Map<string, PluginPortInfo>();

  constructor(
    private readonly pluginService: PluginService,
    private readonly liveParameterService: LiveParameterService = new LiveParameterService(),
    private readonly graphLayoutService: GraphLayoutService = new GraphLayoutService()
  ) {}

  async buildPlan(plan: PedalboardPlan): Promise<LiveGraphAuthoringPlan> {
    const availableUris = await this.installedPluginUris();
    const resolvedPlugins = await this.resolvePlugins(plan.signalChain);

    const validationErrors: string[] = [];
    const pluginUris = this.validatePluginUris(plan.signalChain, availableUris, validationErrors);
    const ports = this.validatePorts(resolvedPlugins, validationErrors);
    const parameterValidation = this.validateParameters(resolvedPlugins, validationErrors);
    const connectionValidation = this.validateConnections(resolvedPlugins, validationErrors);
    const snapshotSave = {
      included: plan.snapshots.length > 0,
      valid: true,
      note:
        plan.snapshots.length > 1
          ? `${plan.snapshots.length} snapshots will be saved: ${plan.snapshots.map((s) => s.name).join(", ")}.`
          : plan.snapshots.length === 1
            ? `1 snapshot will be saved: ${plan.snapshots[0].name}.`
            : "No snapshot save requested; device will retain current default state."
    };

    const title = this.titleFromPlan(plan);
    const pedalboardSave = {
      valid: true,
      title
    };

    const layout = this.graphLayoutService.layoutPlugins(
      resolvedPlugins.map((resolved) => resolved.plan)
    );
    const pluginPlans = resolvedPlugins.map((resolved, index) =>
      this.toPluginPlan(resolved, layout[index])
    );
    const connectionCalls = this.buildConnectionCalls(resolvedPlugins);
    const apiCalls = this.buildApiCalls(pluginPlans, connectionCalls, plan.snapshots, title);
    const postSaveApiCalls: LiveGraphApiCall[] = [];

    const valid =
      pluginUris.valid &&
      ports.valid &&
      connectionValidation.valid &&
      parameterValidation.valid &&
      snapshotSave.valid &&
      pedalboardSave.valid;

    return {
      dryRun: true,
      sourcePlan: plan,
      title,
      validation: {
        valid,
        errors: validationErrors,
        pluginUris,
        ports,
        connections: connectionValidation,
        parameters: parameterValidation,
        snapshotSave,
        pedalboardSave
      },
      plugins: pluginPlans,
      apiCalls: valid ? apiCalls : [],
      postSaveApiCalls: valid ? postSaveApiCalls : [],
      notes: [
        "Read-only live API plan only; no writes were executed.",
        "effect/add and effect/connect are planned in the same order as the live MOD UI graph bootstrap.",
        snapshotSave.note,
        "If confirmed later, the generated live graph can be saved as a new pedalboard through /pedalboard/save."
      ],
      unsupportedIdeas: plan.unsupportedIdeas
    };
  }

  private async installedPluginUris(): Promise<Set<string>> {
    const pluginList = await this.pluginService.listPlugins("uris");
    return new Set(
      pluginList.plugins.map((plugin) => plugin.uri).filter((uri): uri is string => Boolean(uri))
    );
  }

  private async resolvePlugins(signalChain: PlannedPlugin[]): Promise<ResolvedPlugin[]> {
    return Promise.all(
      signalChain.map(async (plan) => {
        const ports = plan.uri
          ? await this.getPluginPorts(plan.uri)
          : { uri: "", ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
        return { plan, ports, controlRanges: [] as LiveGraphParameterPlan[] };
      })
    );
  }

  private async getPluginPorts(uri: string): Promise<PluginPortInfo> {
    const cached = this.portCache.get(uri);
    if (cached) return cached;
    const ports = await this.pluginService.getPluginPorts(uri);
    this.portCache.set(uri, ports);
    return ports;
  }

  private validatePluginUris(
    signalChain: PlannedPlugin[],
    availableUris: Set<string>,
    errors: string[]
  ) {
    const checked = signalChain
      .map((plugin) => plugin.uri)
      .filter((uri): uri is string => Boolean(uri));
    const missing = signalChain.flatMap((plugin) => {
      if (!plugin.uri) return [`${plugin.name}: missing plugin URI`];
      return availableUris.has(plugin.uri) ? [] : [plugin.uri];
    });

    if (missing.length > 0) {
      errors.push(`Missing installed plugin URIs: ${missing.join(", ")}`);
    }

    return {
      valid: missing.length === 0,
      checked,
      missing
    };
  }

  private validatePorts(resolvedPlugins: ResolvedPlugin[], errors: string[]) {
    const portErrors: string[] = [];

    for (const resolved of resolvedPlugins) {
      if (resolved.ports.ports.length === 0) {
        portErrors.push(`Missing LV2 metadata for ${resolved.plan.uri || resolved.plan.name}`);
        continue;
      }
      if (resolved.ports.audioInputs.length === 0) {
        portErrors.push(`No audio input ports for ${resolved.plan.uri || resolved.plan.name}`);
      }
      if (resolved.ports.audioOutputs.length === 0) {
        portErrors.push(`No audio output ports for ${resolved.plan.uri || resolved.plan.name}`);
      }
    }

    if (portErrors.length > 0) {
      errors.push(...portErrors);
    }

    return {
      valid: portErrors.length === 0,
      errors: portErrors
    };
  }

  private validateParameters(
    resolvedPlugins: ResolvedPlugin[],
    errors: string[]
  ): LiveGraphAuthoringValidation["parameters"] {
    const parameterErrors: string[] = [];
    let callCount = 0;

    for (const resolved of resolvedPlugins) {
      const plans = this.resolveParameterPlans(resolved.plan, resolved.ports, parameterErrors);
      resolved.controlRanges.push(...plans);
      callCount += plans.length;
    }

    if (parameterErrors.length > 0) {
      errors.push(...parameterErrors);
    }

    return {
      valid: parameterErrors.length === 0,
      errors: parameterErrors,
      callCount
    };
  }

  private validateConnections(
    resolvedPlugins: ResolvedPlugin[],
    errors: string[]
  ): LiveGraphAuthoringValidation["connections"] {
    const connectionErrors: string[] = [];
    let callCount = 0;

    if (resolvedPlugins.length === 0) {
      callCount = 1;
      return {
        valid: true,
        errors: [],
        callCount
      };
    }

    const first = resolvedPlugins[0];
    if (first.ports.audioInputs.length === 0) {
      connectionErrors.push(
        `Cannot connect capture ports to ${first.plan.uri || first.plan.name} because it has no audio inputs`
      );
    }
    if (first.ports.audioOutputs.length === 0) {
      connectionErrors.push(
        `Cannot connect ${first.plan.uri || first.plan.name} to downstream plugins because it has no audio outputs`
      );
    }

    for (let index = 0; index < resolvedPlugins.length - 1; index += 1) {
      const current = resolvedPlugins[index];
      const next = resolvedPlugins[index + 1];
      if (current.ports.audioOutputs.length === 0) {
        connectionErrors.push(
          `Cannot connect from ${current.plan.uri || current.plan.name}; no audio outputs found`
        );
      }
      if (next.ports.audioInputs.length === 0) {
        connectionErrors.push(
          `Cannot connect to ${next.plan.uri || next.plan.name}; no audio inputs found`
        );
      }
    }

    const last = resolvedPlugins[resolvedPlugins.length - 1];
    if (last.ports.audioOutputs.length === 0) {
      connectionErrors.push(
        `Cannot connect ${last.plan.uri || last.plan.name} to playback ports because it has no audio outputs`
      );
    }

    callCount = this.buildConnectionPairs(resolvedPlugins).length;

    if (connectionErrors.length > 0) {
      errors.push(...connectionErrors);
    }

    return {
      valid: connectionErrors.length === 0,
      errors: connectionErrors,
      callCount
    };
  }

  private resolveParameterPlans(
    plan: PlannedPlugin,
    ports: PluginPortInfo,
    errors: string[]
  ): LiveGraphParameterPlan[] {
    const resolved = this.liveParameterService.resolveParameterPlans(
      plan.name,
      ports,
      plan.parameterRanges
    );
    errors.push(...resolved.errors);
    return resolved.parameterPlans;
  }

  private toPluginPlan(
    resolved: ResolvedPlugin,
    layout: Pick<GraphLayoutPlacement, "x" | "y">
  ): LiveGraphPluginPlan {
    const instance = safeInstance(resolved.plan);

    return {
      role: resolved.plan.role,
      name: resolved.plan.name,
      uri: resolved.plan.uri ?? "",
      instance,
      x: layout.x,
      y: layout.y,
      addCall: this.effectAddCall(instance, resolved.plan.uri ?? "", layout.x, layout.y),
      parameterPlans: resolved.controlRanges,
      connectCalls: []
    };
  }

  private effectAddCall(instance: string, uri: string, x: number, y: number): LiveGraphApiCall {
    return {
      method: "GET",
      path: `/effect/add/${uiGraphInstancePath(instance)}?x=${x}&y=${y}&uri=${legacyEscape(uri)}`,
      purpose: `add plugin instance ${instance}`,
      body: { kind: "none" }
    };
  }

  private buildConnectionCalls(resolvedPlugins: ResolvedPlugin[]): LiveGraphApiCall[] {
    return this.buildConnectionPairs(resolvedPlugins).map(([source, target]) => ({
      method: "GET" as const,
      path: `/effect/connect/${source},${target}`,
      purpose: `connect ${source} to ${target}`,
      body: { kind: "none" as const }
    }));
  }

  private buildConnectionPairs(resolvedPlugins: ResolvedPlugin[]): Array<[string, string]> {
    if (resolvedPlugins.length === 0) {
      return [["capture_1", "playback_1"]];
    }

    const pairs: Array<[string, string]> = [];
    const first = resolvedPlugins[0];
    for (const [source, target] of pairPorts(["capture_1", "capture_2"], inputRefs(first))) {
      pairs.push([source, target]);
    }

    for (let index = 0; index < resolvedPlugins.length - 1; index += 1) {
      const current = resolvedPlugins[index];
      const next = resolvedPlugins[index + 1];
      for (const [source, target] of pairPorts(outputRefs(current), inputRefs(next))) {
        pairs.push([source, target]);
      }
    }

    const last = resolvedPlugins[resolvedPlugins.length - 1];
    for (const [source, target] of pairPorts(outputRefs(last), ["playback_1", "playback_2"])) {
      pairs.push([source, target]);
    }

    return pairs;
  }

  private buildApiCalls(
    plugins: LiveGraphPluginPlan[],
    connectionCalls: LiveGraphApiCall[],
    snapshots: PedalboardPlan["snapshots"],
    title: string
  ): LiveGraphApiCall[] {
    const calls: LiveGraphApiCall[] = [];

    for (const plugin of plugins) {
      calls.push(plugin.addCall);
    }
    calls.push(...connectionCalls);

    if (snapshots.length === 0) {
      for (const plugin of plugins) {
        for (const parameter of plugin.parameterPlans) {
          calls.push(this.liveParameterService.buildParameterCall(plugin.instance, parameter));
        }
      }
    } else {
      // Set params for snapshot 0 only — the bundle will be saved in this state.
      // Remaining snapshot saves happen after the asNew:1 save, via buildPostSaveSnapshotCalls.
      for (const plugin of plugins) {
        for (const parameter of plugin.parameterPlans) {
          const value = parameter.resolvedRange
            ? snapshotParamValue(parameter.resolvedRange, parameter.value, 0, snapshots.length)
            : parameter.value;
          calls.push(
            this.liveParameterService.buildParameterCallWithValue(plugin.instance, parameter, value)
          );
        }
      }
    }

    calls.push({
      method: "POST",
      path: "/pedalboard/save",
      purpose: "save current live graph as a new pedalboard",
      body: { kind: "form", fields: { title, asNew: 1 } }
    });

    return calls;
  }

  buildSnapshotsJsonContent(
    plugins: LiveGraphPluginPlan[],
    snapshots: PedalboardPlan["snapshots"]
  ): string {
    const snapshotList = snapshots.map((snapshot, i) => {
      const data: Record<string, {
        ports: Record<string, number>;
        parameters: Record<string, never>;
        preset: string;
        bypassed: boolean;
      }> = {};
      for (const plugin of plugins) {
        const ports: Record<string, number> = {};
        for (const param of plugin.parameterPlans) {
          ports[param.symbol] = param.resolvedRange
            ? snapshotParamValue(param.resolvedRange, param.value, i, snapshots.length)
            : param.value;
        }
        data[plugin.instance] = { ports, parameters: {} as Record<string, never>, preset: "", bypassed: false };
      }
      return { name: snapshot.name, data };
    });
    return JSON.stringify({ current: 0, snapshots: snapshotList }, null, 4);
  }

  buildPostSaveSnapshotCalls(
    plugins: LiveGraphPluginPlan[],
    snapshots: PedalboardPlan["snapshots"],
    savedTitle: string
  ): LiveGraphApiCall[] {
    if (snapshots.length === 0) return [];

    const calls: LiveGraphApiCall[] = [];

    // Rename slot 0 from "Default" to the first snapshot name.
    calls.push({
      method: "POST",
      path: "/snapshot/save",
      purpose: `rename snapshot 0 to: ${snapshots[0].name}`,
      body: { kind: "form", fields: { id: 0, name: snapshots[0].name } }
    });

    // For each additional snapshot: set params then CREATE via /snapshot/saveas.
    // POST /snapshot/save only renames existing slots; /snapshot/saveas creates new ones.
    for (let i = 1; i < snapshots.length; i++) {
      for (const plugin of plugins) {
        for (const parameter of plugin.parameterPlans) {
          const value = parameter.resolvedRange
            ? snapshotParamValue(parameter.resolvedRange, parameter.value, i, snapshots.length)
            : parameter.value;
          calls.push(
            this.liveParameterService.buildParameterCallWithValue(plugin.instance, parameter, value)
          );
        }
      }
      calls.push({
        method: "GET",
        path: `/snapshot/saveas?title=${encodeURIComponent(snapshots[i].name)}`,
        purpose: `create snapshot ${i}: ${snapshots[i].name}`,
        body: { kind: "none" }
      });
    }

    // Restore to snapshot 0 params so the board opens in the first snapshot's state.
    if (snapshots.length > 1) {
      for (const plugin of plugins) {
        for (const parameter of plugin.parameterPlans) {
          const value = parameter.resolvedRange
            ? snapshotParamValue(parameter.resolvedRange, parameter.value, 0, snapshots.length)
            : parameter.value;
          calls.push(
            this.liveParameterService.buildParameterCallWithValue(plugin.instance, parameter, value)
          );
        }
      }
    }

    // Persist in-place. The device knows which bundle is active from the prior asNew:1 save.
    calls.push({
      method: "POST",
      path: "/pedalboard/save",
      purpose: "persist snapshot data to the saved bundle",
      body: { kind: "form", fields: { title: savedTitle, asNew: 0 } }
    });

    return calls;
  }

  private titleFromPlan(plan: PedalboardPlan): string {
    return `${plan.request.instrument} ${plan.request.style}`.trim() || "Live Graph Pedalboard";
  }
}

function inputRefs(plugin: ResolvedPlugin): string[] {
  const instance = safeInstance(plugin.plan);
  return plugin.ports.audioInputs.map((port) => `${instance}/${port.symbol}`);
}

function outputRefs(plugin: ResolvedPlugin): string[] {
  const instance = safeInstance(plugin.plan);
  return plugin.ports.audioOutputs.map((port) => `${instance}/${port.symbol}`);
}

function pairPorts(sources: string[], destinations: string[]): Array<[string, string]> {
  if (sources.length === 0 || destinations.length === 0) return [];
  if (sources.length === 1) return destinations.map((destination) => [sources[0], destination]);
  if (destinations.length === 1) return [[sources[0], destinations[0]]];
  return destinations.map((destination, index) => [
    sources[Math.min(index, sources.length - 1)],
    destination
  ]);
}

function safeInstance(plugin: PlannedPlugin): string {
  return slug(plugin.suggestedInstance || plugin.name || plugin.role);
}

function slug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "pedalboard";
}

function legacyEscape(value: string): string {
  return escape(value);
}

function snapshotParamValue(
  range: { min: number; max: number },
  baseValue: number,
  snapshotIndex: number,
  snapshotCount: number
): number {
  if (snapshotCount <= 1) return baseValue;
  const t = snapshotIndex / (snapshotCount - 1);
  return range.min + (range.max - range.min) * t;
}
