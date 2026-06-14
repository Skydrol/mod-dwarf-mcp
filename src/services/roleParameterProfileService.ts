import type { PluginPort, PluginPortInfo } from "../types/plugin.js";

export interface RoleParameterProfileResult {
  parameterRanges: Record<string, { min: number; max: number; unit?: string }>;
  warnings: string[];
  unsupportedIdeas: string[];
  valid: boolean;
}

interface ParameterProfileEntry {
  candidates: string[];
  safeRange: { min: number; max: number; unit?: string };
  required?: boolean;
}

interface RoleProfileDefinition {
  entries: ParameterProfileEntry[];
  requireAny?: boolean;
}

export class RoleParameterProfileService {
  resolve(
    role: string,
    pluginName: string,
    pluginUri: string | undefined,
    ports: PluginPortInfo,
    promptText: string
  ): RoleParameterProfileResult {
    const profile = this.definitionFor(role, pluginName, pluginUri, promptText);
    const parameterRanges: Record<string, { min: number; max: number; unit?: string }> = {};
    const warnings: string[] = [];
    const unsupportedIdeas: string[] = [];
    const missingRequired: string[] = [];
    const used = new Set<string>();

    for (const entry of profile.entries) {
      const port = findExactControlPort(entry.candidates, ports.controlInputs, used);
      if (!port) {
        if (entry.required || profile.requireAny) {
          missingRequired.push(entry.candidates[0]);
        }
        continue;
      }

      used.add(port.symbol);
      const range = intersectSafeRange(entry.safeRange, port);
      if (!range) {
        if (entry.required || profile.requireAny) {
          missingRequired.push(port.symbol);
        }
        continue;
      }
      parameterRanges[port.symbol] = range;
    }

    if (missingRequired.length > 0 || Object.keys(parameterRanges).length === 0) {
      unsupportedIdeas.push(
        `No valid parameter profile found for role '${role}' on ${pluginName || pluginUri || "unknown plugin"}`
      );
    }

    if (missingRequired.length > 0) {
      warnings.push(
        `Role '${role}' on ${pluginName || pluginUri || "unknown plugin"} is missing required controls: ${missingRequired.join(", ")}`
      );
    }

    if (isUnsafePrompt(promptText)) {
      warnings.push(
        `Prompt cue '${unsafeCue(promptText)}' was interpreted safely; no runaway or boosted parameter ranges were generated.`
      );
    }

    return {
      parameterRanges,
      warnings,
      unsupportedIdeas,
      valid: missingRequired.length === 0 && Object.keys(parameterRanges).length > 0
    };
  }

  private definitionFor(
    role: string,
    pluginName: string,
    pluginUri: string | undefined,
    promptText: string
  ): RoleProfileDefinition {
    const normalizedRole = normalize(role);
    const normalizedPlugin = normalize(`${pluginName} ${pluginUri ?? ""}`);
    const wantsFeedbackHeavy = matchesAny(normalize(promptText), [
      "maximumfeedback",
      "infinite",
      "selfoscillating",
      "loudestpossible"
    ]);

    if (normalizedRole === "inputgain") {
      return {
        entries: [
          {
            candidates: ["Gain", "gain", "Level", "level", "Output Level"],
            safeRange: { min: -12, max: 0, unit: "dB" },
            required: true
          }
        ]
      };
    }

    if (normalizedRole === "outputlevel") {
      return {
        entries: [
          {
            candidates: ["Gain", "gain", "Level", "level", "Output Level"],
            safeRange: { min: -12, max: 0, unit: "dB" },
            required: true
          }
        ]
      };
    }

    if (normalizedRole === "highgaindrive") {
      return {
        entries: [
          { candidates: ["PREGAIN"], safeRange: { min: -6, max: 0, unit: "dB" }, required: true },
          { candidates: ["MASTER"], safeRange: { min: -6, max: 0, unit: "dB" }, required: true },
          { candidates: ["BASS"], safeRange: { min: -2, max: 0, unit: "dB" } },
          { candidates: ["MID"], safeRange: { min: -2, max: 0, unit: "dB" } },
          { candidates: ["TREBLE"], safeRange: { min: -2, max: 0, unit: "dB" } }
        ]
      };
    }

    if (normalizedRole === "cabinet") {
      if (normalizedPlugin.includes("vintagecabinets")) {
        return {
          entries: [
            {
              candidates: ["Attenuation"],
              safeRange: { min: -18, max: -6, unit: "dB" },
              required: true
            }
          ]
        };
      }

      return {
        entries: [
          { candidates: ["Gain"], safeRange: { min: -12, max: 0, unit: "dB" } },
          { candidates: ["level"], safeRange: { min: -12, max: 0, unit: "dB" } }
        ]
      };
    }

    if (normalizedRole === "cleantoneshaper") {
      if (normalizedPlugin.includes("vintagecabinets")) {
        return {
          entries: [
            {
              candidates: ["Attenuation"],
              safeRange: { min: -18, max: -6, unit: "dB" },
              required: true
            }
          ]
        };
      }

      return {
        entries: [
          { candidates: ["Gain"], safeRange: { min: -6, max: 0, unit: "dB" }, required: true },
          { candidates: ["level"], safeRange: { min: -6, max: 0, unit: "dB" }, required: true }
        ]
      };
    }

    if (normalizedRole === "coretone") {
      return {
        entries: [
          { candidates: ["Gain"], safeRange: { min: -9, max: 0, unit: "dB" }, required: true },
          { candidates: ["level"], safeRange: { min: -9, max: 0, unit: "dB" }, required: true }
        ]
      };
    }

    if (normalizedRole === "dynamics") {
      return {
        entries: [
          { candidates: ["threshold"], safeRange: { min: -36, max: -18, unit: "dB" }, required: true },
          { candidates: ["ratio"], safeRange: { min: 2, max: 6 }, required: true },
          { candidates: ["attack"], safeRange: { min: 0.001, max: 0.03, unit: "s" }, required: true },
          { candidates: ["release"], safeRange: { min: 0.05, max: 0.4, unit: "s" }, required: true }
        ]
      };
    }

    if (normalizedRole === "modulation") {
      return {
        entries: [
          { candidates: ["Frequency"], safeRange: { min: 0.1, max: 1.5, unit: "Hz" }, required: true },
          { candidates: ["Depth"], safeRange: { min: 15, max: 70, unit: "%" }, required: true },
          { candidates: ["WetLevel"], safeRange: { min: -12, max: -3, unit: "dB" } },
          { candidates: ["DryLevel"], safeRange: { min: -3, max: 0, unit: "dB" } },
          { candidates: ["Delay"], safeRange: { min: 10, max: 40, unit: "%" } }
        ]
      };
    }

    if (normalizedRole === "delay" || normalizedRole === "feedbackcapabledelay") {
      return {
        entries: [
          {
            candidates: ["tempo_user"],
            safeRange: wantsFeedbackHeavy
              ? { min: 100, max: 180 }
              : { min: 90, max: 180 },
            required: true
          },
          {
            candidates: ["feedback"],
            safeRange: wantsFeedbackHeavy
              ? { min: 25, max: 45, unit: "%" }
              : { min: 15, max: 33, unit: "%" },
            required: true
          },
          { candidates: ["mix"], safeRange: { min: 10, max: 40, unit: "%" } },
          { candidates: ["tempo_mode"], safeRange: { min: 0, max: 1 }, required: false }
        ]
      };
    }

    if (normalizedRole === "reverb") {
      if (normalizedPlugin.includes("dragonfly")) {
        return {
          entries: [
            { candidates: ["late_level"], safeRange: { min: 20, max: 45, unit: "%" }, required: true },
            { candidates: ["size"], safeRange: { min: 25, max: 60, unit: "%" }, required: true },
            { candidates: ["width"], safeRange: { min: 100, max: 150, unit: "%" }, required: true },
            { candidates: ["dry_level"], safeRange: { min: 0, max: 15, unit: "%" } },
            { candidates: ["early_level"], safeRange: { min: 10, max: 30, unit: "%" } },
            { candidates: ["delay"], safeRange: { min: 0, max: 25, unit: "%" } },
            { candidates: ["diffuse"], safeRange: { min: 35, max: 70, unit: "%" } }
          ]
        };
      }

      if (normalizedPlugin.includes("mverb")) {
        return {
          entries: [
            { candidates: ["decay"], safeRange: { min: 1.2, max: 4.5, unit: "s" }, required: true },
            { candidates: ["mix"], safeRange: { min: 8, max: 22, unit: "%" }, required: true },
            { candidates: ["earlymix"], safeRange: { min: 10, max: 35, unit: "%" } }
          ]
        };
      }

      return {
        entries: [
          { candidates: ["decay"], safeRange: { min: 1.2, max: 4.5, unit: "s" }, required: true },
          { candidates: ["mix"], safeRange: { min: 8, max: 22, unit: "%" }, required: true },
          { candidates: ["predelay"], safeRange: { min: 0, max: 25, unit: "ms" } }
        ]
      };
    }

    return { entries: [] };
  }
}

function findExactControlPort(candidates: string[], ports: PluginPort[], used: Set<string>): PluginPort | null {
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    const port = ports.find(
      (item) =>
        !used.has(item.symbol) &&
        (normalize(item.symbol) === normalizedCandidate ||
          normalize(item.name ?? "") === normalizedCandidate)
    );
    if (port) return port;
  }
  return null;
}

function intersectSafeRange(
  safeRange: { min: number; max: number; unit?: string },
  port: PluginPort
): { min: number; max: number; unit?: string } | null {
  const min = Math.max(safeRange.min, port.minimum ?? safeRange.min);
  const max = Math.min(safeRange.max, port.maximum ?? safeRange.max);
  if (min > max) return null;
  return { min, max, unit: port.unit ?? safeRange.unit };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalize(needle)));
}

function isUnsafePrompt(promptText: string): boolean {
  const normalized = normalize(promptText);
  return matchesAny(normalized, ["maximumfeedback", "infinite", "loudestpossible", "selfoscillating"]);
}

function unsafeCue(promptText: string): string {
  const normalized = normalize(promptText);
  if (normalized.includes("maximumfeedback")) return "maximum feedback";
  if (normalized.includes("infinite")) return "infinite";
  if (normalized.includes("loudestpossible")) return "loudest possible";
  if (normalized.includes("selfoscillating")) return "self-oscillating";
  return "unsafe prompt";
}
