import type { PluginService } from "./pluginService.js";
import type { PedalboardPlan, PlannedPlugin } from "../types/plan.js";
import type {
  LiveGraphApiCall,
  LiveGraphAuthoringPlan,
  LiveGraphAuthoringValidation,
  LiveGraphParameterPlan,
  LiveGraphPluginPlan,
  LiveGraphPortRange
} from "../types/liveGraphAuthoringPlan.js";
import type { PluginPort, PluginPortInfo } from "../types/plugin.js";
import { uiGraphInstancePath } from "./liveGraphRefs.js";

interface ResolvedPlugin {
  plan: PlannedPlugin;
  ports: PluginPortInfo;
  controlRanges: LiveGraphParameterPlan[];
}

export class LiveGraphAuthoringPlanService {
  private readonly portCache = new Map<string, PluginPortInfo>();

  constructor(private readonly pluginService: PluginService) {}

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
        plan.snapshots.length > 0
          ? plan.snapshots.length === 1
            ? `Will save the current snapshot using '${plan.snapshots[0].name}'.`
            : "Only the current snapshot can be saved with /snapshot/save; additional planned snapshots are not expressible with the allowed API set."
          : "No snapshot save call requested."
    };

    const title = this.titleFromPlan(plan);
    const pedalboardSave = {
      valid: true,
      title
    };

    const pluginPlans = resolvedPlugins.map((resolved, index) =>
      this.toPluginPlan(resolved, index)
    );
    const connectionCalls = this.buildConnectionCalls(resolvedPlugins);
    const apiCalls = this.buildApiCalls(pluginPlans, connectionCalls, snapshotSave.included, title);

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
      notes: [
        "Read-only live API plan only; no writes were executed.",
        "effect/add and effect/connect are planned in the same order as the live MOD UI graph bootstrap.",
        snapshotSave.note,
        "The resulting pedalboard is saved as a new bundle through /pedalboard/save."
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
      const used = new Set<string>();
      const plans = this.resolveParameterPlans(
        resolved.plan,
        resolved.ports,
        used,
        parameterErrors
      );
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
    used: Set<string>,
    errors: string[]
  ): LiveGraphParameterPlan[] {
    return Object.entries(plan.parameterRanges).flatMap(([requestedKey, requestedRange]) => {
      const port = findControlPort(requestedKey, ports.controlInputs, used);
      if (!port) {
        errors.push(`Parameter '${requestedKey}' not found on ${plan.uri || plan.name}`);
        return [];
      }

      used.add(port.symbol);
      const resolvedRange = this.resolveRange(requestedRange, port);
      if (resolvedRange.min > resolvedRange.max) {
        errors.push(
          `Parameter '${requestedKey}' on ${plan.uri || plan.name} has no overlap between requested and device ranges`
        );
        return [];
      }

      const value = midpoint(resolvedRange.min, resolvedRange.max);
      if (port.minimum !== undefined && value < port.minimum) {
        errors.push(
          `Parameter '${requestedKey}' on ${plan.uri || plan.name} resolved below device minimum`
        );
        return [];
      }
      if (port.maximum !== undefined && value > port.maximum) {
        errors.push(
          `Parameter '${requestedKey}' on ${plan.uri || plan.name} resolved above device maximum`
        );
        return [];
      }

      return [
        {
          requestedKey,
          symbol: port.symbol,
          requestedRange,
          resolvedRange,
          value
        }
      ];
    });
  }

  private resolveRange(requested: LiveGraphPortRange, port: PluginPort): LiveGraphPortRange {
    const min = Math.max(requested.min, port.minimum ?? requested.min);
    const max = Math.min(requested.max, port.maximum ?? requested.max);
    return {
      min,
      max,
      unit: port.unit ?? requested.unit
    };
  }

  private toPluginPlan(resolved: ResolvedPlugin, index: number): LiveGraphPluginPlan {
    const instance = safeInstance(resolved.plan);
    const x = 100 + index * 220;
    const y = index % 2 === 0 ? 180 : 300;

    return {
      role: resolved.plan.role,
      name: resolved.plan.name,
      uri: resolved.plan.uri ?? "",
      instance,
      x,
      y,
      addCall: this.effectAddCall(instance, resolved.plan.uri ?? "", x, y),
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
    includeSnapshotSave: boolean,
    title: string
  ): LiveGraphApiCall[] {
    const calls: LiveGraphApiCall[] = [];
    for (const plugin of plugins) {
      calls.push(plugin.addCall);
    }

    calls.push(...connectionCalls);

    for (const plugin of plugins) {
      for (const parameter of plugin.parameterPlans) {
        calls.push({
          method: "POST",
          path: "/effect/parameter/set/",
          purpose: `set ${plugin.instance}/${parameter.symbol} to ${formatNumber(parameter.value)}`,
          body: {
            kind: "json",
            value: {
              instance: `/graph/${plugin.instance}`,
              symbol: parameter.symbol,
              value: parameter.value
            }
          }
        });
      }
    }

    if (includeSnapshotSave) {
      calls.push({
        method: "POST",
        path: "/snapshot/save",
        purpose: "save current snapshot",
        body: { kind: "none" }
      });
    }

    calls.push({
      method: "POST",
      path: "/pedalboard/save",
      purpose: "save current live graph as a new pedalboard",
      body: {
        kind: "form",
        fields: {
          title,
          asNew: 1
        }
      }
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

function findControlPort(key: string, ports: PluginPort[], used: Set<string>): PluginPort | null {
  const normalizedKey = normalizePortKey(key);

  const exactSymbol = ports.find(
    (port) => !used.has(port.symbol) && normalizePortKey(port.symbol) === normalizedKey
  );
  if (exactSymbol) return exactSymbol;

  const exactName = ports.find(
    (port) => !used.has(port.symbol) && normalizePortKey(port.name ?? "") === normalizedKey
  );
  if (exactName) return exactName;

  const aliases = CONTROL_ALIASES[normalizedKey] ?? [];
  for (const alias of aliases) {
    const normalizedAlias = normalizePortKey(alias);
    const matched = ports.find(
      (port) =>
        !used.has(port.symbol) &&
        (normalizePortKey(port.symbol) === normalizedAlias ||
          normalizePortKey(port.name ?? "") === normalizedAlias)
    );
    if (matched) return matched;
  }

  return null;
}

const CONTROL_ALIASES: Record<string, string[]> = {
  gain: ["gain", "volume", "level"],
  level: ["level", "volume", "gain"],
  mix: ["mix", "blend", "wetlevel", "wet", "earlylevel"],
  feedback: ["feedback"],
  time: ["time", "delay", "delaytime", "divl"],
  rate: ["rate", "frequency"],
  depth: ["depth"],
  threshold: ["threshold", "thr"],
  ratio: ["ratio", "rat"],
  attack: ["attack", "att"],
  release: ["release", "rel"],
  decay: ["decay"],
  lowcut: ["lowcut", "lowf"],
  highcut: ["highcut", "highf"]
};

function normalizePortKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function midpoint(min: number, max: number): number {
  return min + (max - min) / 2;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
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
