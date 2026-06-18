import type {
  LiveGraphApiCall,
  LiveGraphParameterPlan,
  LiveGraphPortRange
} from "../types/liveGraphAuthoringPlan.js";
import type { PluginPort, PluginPortInfo } from "../types/plugin.js";
import { uiGraphRef } from "./liveGraphRefs.js";

export interface LiveParameterValidationResult {
  valid: boolean;
  errors: string[];
}

export class LiveParameterService {
  resolveParameterPlans(
    planName: string,
    ports: PluginPortInfo,
    requestedRanges: Record<string, LiveGraphPortRange>
  ): {
    parameterPlans: LiveGraphParameterPlan[];
    errors: string[];
  } {
    const used = new Set<string>();
    const errors: string[] = [];
    const parameterPlans: LiveGraphParameterPlan[] = [];

    for (const [requestedKey, requestedRange] of Object.entries(requestedRanges)) {
      const port = findControlPort(requestedKey, ports.controlInputs, used);
      if (!port) {
        errors.push(`Parameter '${requestedKey}' not found on ${ports.uri || planName}`);
        continue;
      }

      used.add(port.symbol);
      const resolvedRange = this.resolveRange(requestedRange, port);
      if (resolvedRange.min > resolvedRange.max) {
        errors.push(
          `Parameter '${requestedKey}' on ${ports.uri || planName} has no overlap between requested and device ranges`
        );
        continue;
      }

      const value = this.suggestValue(port, resolvedRange);
      const parameterPlan: LiveGraphParameterPlan = {
        requestedKey,
        symbol: port.symbol,
        name: port.name ?? port.symbol,
        minimum: port.minimum ?? resolvedRange.min,
        maximum: port.maximum ?? resolvedRange.max,
        default: port.default,
        unit: port.unit ?? resolvedRange.unit,
        properties: port.properties,
        requestedRange,
        resolvedRange,
        value
      };
      const validation = this.validateParameterPlan(ports.uri || planName, parameterPlan);
      if (!validation.valid) {
        errors.push(...validation.errors);
        continue;
      }
      parameterPlans.push(parameterPlan);
    }

    return { parameterPlans, errors };
  }

  validateParameterPlan(
    instance: string,
    parameter: LiveGraphParameterPlan
  ): LiveParameterValidationResult {
    const errors: string[] = [];

    if (!parameter.symbol.trim()) {
      errors.push(`Parameter on ${instance} is missing a symbol.`);
    }
    if (!Number.isFinite(parameter.value)) {
      errors.push(`Parameter ${instance}/${parameter.symbol} has a non-finite value.`);
    }
    if (parameter.value < parameter.minimum || parameter.value > parameter.maximum) {
      errors.push(
        `Parameter ${instance}/${parameter.symbol} value ${parameter.value} is outside ${parameter.minimum}..${parameter.maximum}.`
      );
    }
    if (isIntegerLike(parameter.properties) && !Number.isInteger(parameter.value)) {
      errors.push(`Parameter ${instance}/${parameter.symbol} must be an integer.`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  buildParameterCall(instance: string, parameter: LiveGraphParameterPlan): LiveGraphApiCall {
    return this.buildParameterCallWithValue(instance, parameter, parameter.value);
  }

  buildParameterCallWithValue(
    instance: string,
    parameter: LiveGraphParameterPlan,
    value: number
  ): LiveGraphApiCall {
    return {
      method: "POST",
      path: "/effect/parameter/set/",
      purpose: `set ${instance}/${parameter.symbol} to ${formatNumber(value)}`,
      body: {
        kind: "json",
        value: `${uiGraphRef(instance)}/${parameter.symbol}/${formatNumber(value)}`
      }
    };
  }

  buildParameterCalls(
    instance: string,
    parameters: LiveGraphParameterPlan[]
  ): { calls: LiveGraphApiCall[]; validation: LiveParameterValidationResult } {
    const errors: string[] = [];
    const calls: LiveGraphApiCall[] = [];

    for (const parameter of parameters) {
      const validation = this.validateParameterPlan(instance, parameter);
      if (!validation.valid) {
        errors.push(...validation.errors);
        continue;
      }
      calls.push(this.buildParameterCall(instance, parameter));
    }

    return {
      calls,
      validation: {
        valid: errors.length === 0,
        errors
      }
    };
  }

  suggestValue(port: PluginPort, requestedRange?: { min: number; max: number }): number {
    const minimum = requestedRange?.min ?? port.minimum ?? port.default ?? 0;
    const maximum = requestedRange?.max ?? port.maximum ?? port.default ?? minimum;
    const lower = port.minimum ?? minimum;
    const upper = port.maximum ?? maximum;
    const min = Math.max(minimum, lower);
    const max = Math.min(maximum, upper);

    if (min > max) {
      return midpoint(minimum, maximum);
    }

    const preferred = preferredValue(port, min, max);
    if (preferred !== null) {
      return preferred;
    }

    if (typeof port.default === "number" && port.default >= min && port.default <= max) {
      return port.default;
    }

    return midpoint(min, max);
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
}

function preferredValue(port: PluginPort, min: number, max: number): number | null {
  const normalized = normalize(`${port.symbol} ${port.name ?? ""}`);

  if (matchesAny(normalized, ["gain", "level", "volume", "trim"])) {
    if (min <= -6 && max >= -6) return -6;
    if (min <= -3 && max >= -3) return -3;
  }

  if (matchesAny(normalized, ["mix", "wet", "blend"])) {
    if (min <= 0.35 && max >= 0.35) return 0.35;
    if (min <= 0.3 && max >= 0.3) return 0.3;
  }

  if (matchesAny(normalized, ["feedback", "regen", "repeat"])) {
    if (min <= 0.25 && max >= 0.25) return 0.25;
    if (min <= 0.2 && max >= 0.2) return 0.2;
  }

  if (matchesAny(normalized, ["time", "delay", "ms"])) {
    const candidates = [0.33, 0.25, 0.5];
    for (const ratio of candidates) {
      const candidate = min + (max - min) * ratio;
      if (candidate >= min && candidate <= max) {
        return candidate;
      }
    }
  }

  return null;
}

function isIntegerLike(properties: string[]): boolean {
  return properties.some((property) => normalize(property).includes("integer"));
}

function midpoint(min: number, max: number): number {
  return min + (max - min) / 2;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalize(needle)));
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

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
