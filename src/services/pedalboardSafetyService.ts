import type { PedalboardPlan, PlannedPlugin } from "../types/plan.js";

export interface PedalboardSafetyAdjustment {
  plugin: string;
  parameter: string;
  originalValue: { min: number; max: number; unit?: string };
  adjustedValue: { min: number; max: number; unit?: string };
  reason: string;
}

export interface PedalboardSafetyResult {
  adjustedPlan: PedalboardPlan;
  warnings: string[];
  adjustments: PedalboardSafetyAdjustment[];
}

export class PedalboardSafetyService {
  adjustPlan(plan: PedalboardPlan): PedalboardSafetyResult {
    const adjustedPlan = clonePlan(plan);
    const warnings = this.promptWarnings(plan);
    const adjustments: PedalboardSafetyAdjustment[] = [];

    adjustedPlan.signalChain = adjustedPlan.signalChain.map((plugin, index) =>
      this.adjustPlugin(plugin, index, adjustedPlan.signalChain.length, adjustments)
    );

    if (adjustments.length > 0) {
      warnings.push(this.summaryWarning(adjustments));
    }

    return { adjustedPlan, warnings, adjustments };
  }

  private adjustPlugin(
    plugin: PlannedPlugin,
    index: number,
    pluginCount: number,
    adjustments: PedalboardSafetyAdjustment[]
  ): PlannedPlugin {
    const adjusted = clonePlugin(plugin);
    const pluginLabel = adjusted.name || adjusted.role || adjusted.suggestedInstance;
    const parameterRanges = adjusted.parameterRanges ?? {};

    for (const [parameter, range] of Object.entries(parameterRanges)) {
      const current = { ...range };
      const lowered = this.clampRange(plugin, parameter, current, index, pluginCount);
      if (!rangesEqual(current, lowered)) {
        adjustments.push({
          plugin: pluginLabel,
          parameter,
          originalValue: current,
          adjustedValue: lowered,
          reason: this.reasonFor(plugin, parameter, current, lowered, index, pluginCount)
        });
        parameterRanges[parameter] = lowered;
      }
    }

    adjusted.parameterRanges = parameterRanges;

    return adjusted;
  }

  private clampRange(
    plugin: PlannedPlugin,
    parameter: string,
    range: { min: number; max: number; unit?: string },
    index: number,
    pluginCount: number
  ): { min: number; max: number; unit?: string } {
    const normalized = normalize(`${plugin.role} ${plugin.name} ${parameter}`);
    const unit = range.unit;
    let min = range.min;
    let max = range.max;

    if (isGainLike(normalized, unit)) {
      max = Math.min(max, 0);
      if (min > max) min = max;
      if (index === pluginCount - 1 && max > -3) {
        max = Math.min(max, -3);
        if (min > max) min = max;
      }
    }

    if (isDelayFeedback(normalized)) {
      max = safeFractionCap(min, max, 0.45);
      if (min > max) min = max;
    }

    if (isReverbMix(normalized, plugin)) {
      max = safeFractionCap(min, max, 0.35);
      if (min > max) min = max;
    }

    if (isReverbDecay(normalized, plugin)) {
      max = safeFractionCap(min, max, 0.6);
      if (min > max) min = max;
    }

    return { min, max, unit };
  }

  private promptWarnings(plan: PedalboardPlan): string[] {
    const text = normalize(
      [
        plan.request.style,
        plan.request.instrument,
        ...plan.request.goals,
        ...(plan.request.referenceArtists ?? [])
      ].join(" ")
    );

    const warnings: string[] = [];
    if (matchesAny(text, ["maximumfeedback", "infinite", "loudestpossible", "selfoscillating"])) {
      warnings.push(
        "Prompt requested potentially unsafe feedback or loudness; values were clamped to musical ranges."
      );
    }
    if (matchesAny(text, ["maximum", "hugevolume", "extremelyloud"])) {
      warnings.push("Prompt requested extreme output level; headroom was preserved where possible.");
    }
    return warnings;
  }

  private summaryWarning(adjustments: PedalboardSafetyAdjustment[]): string {
    const categories = new Set<string>();
    for (const adjustment of adjustments) {
      const normalized = normalize(`${adjustment.parameter} ${adjustment.reason}`);
      if (normalized.includes("gain")) categories.add("output gain");
      if (normalized.includes("feedback")) categories.add("delay feedback");
      if (normalized.includes("reverb")) categories.add("reverb");
    }

    const list = Array.from(categories);
    return list.length > 0
      ? `Safety adjustments applied for ${list.join(", ")}.`
      : "Safety adjustments applied to keep the generated pedalboard within musical limits.";
  }

  private reasonFor(
    plugin: PlannedPlugin,
    parameter: string,
    originalValue: { min: number; max: number; unit?: string },
    _adjustedValue: { min: number; max: number; unit?: string },
    index: number,
    pluginCount: number
  ): string {
    const normalized = normalize(`${plugin.role} ${plugin.name} ${parameter}`);

    if (isGainLike(normalized, originalValue.unit)) {
      return index === pluginCount - 1
        ? "Final output gain was limited to at or below 0 dB and kept near a safe headroom band."
        : "Gain-like controls were kept from exceeding 0 dB to preserve headroom.";
    }
    if (isDelayFeedback(normalized)) {
      return "Delay feedback was capped to a safe musical range.";
    }
    if (isReverbMix(normalized, plugin)) {
      return "Reverb mix was reduced to avoid extreme wetness.";
    }
    if (isReverbDecay(normalized, plugin)) {
      return "Reverb decay was reduced to avoid an overly long wash.";
    }

    return `Adjusted ${parameter} to stay inside a safe range.`;
  }
}

function clonePlan(plan: PedalboardPlan): PedalboardPlan {
  return JSON.parse(JSON.stringify(plan)) as PedalboardPlan;
}

function clonePlugin(plugin: PlannedPlugin): PlannedPlugin {
  return JSON.parse(JSON.stringify(plugin)) as PlannedPlugin;
}

function rangesEqual(
  a: { min: number; max: number; unit?: string },
  b: { min: number; max: number; unit?: string }
): boolean {
  return a.min === b.min && a.max === b.max && a.unit === b.unit;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalize(needle)));
}

function isGainLike(normalized: string, unit?: string): boolean {
  if (unit && normalize(unit).includes("db")) return true;
  return matchesAny(normalized, ["gain", "volume", "master", "output level"]);
}

function isDelayFeedback(normalized: string): boolean {
  return matchesAny(normalized, ["feedback", "regen", "repeat"]);
}

function isReverbMix(normalized: string, plugin: PlannedPlugin): boolean {
  const context = normalize(`${plugin.role} ${plugin.name}`);
  return (
    matchesAny(normalized, ["mix", "wet", "blend", "earlylevel"]) &&
    matchesAny(context, ["reverb", "verb", "mverb", "space", "hall", "plate"])
  );
}

function isReverbDecay(normalized: string, plugin: PlannedPlugin): boolean {
  const context = normalize(`${plugin.role} ${plugin.name}`);
  return (
    matchesAny(normalized, ["decay"]) &&
    matchesAny(context, ["reverb", "verb", "mverb", "space", "hall", "plate"])
  );
}

function safeFractionCap(min: number, max: number, fraction: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return max;
  return min + (max - min) * fraction;
}
