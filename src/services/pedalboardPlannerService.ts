import type {
  PedalboardPlan,
  PedalboardPlanInput,
  PlannedPlugin,
  PlannedSnapshot
} from "../types/plan.js";
import type { PedalboardService } from "./pedalboardService.js";
import type { PluginService } from "./pluginService.js";

interface PluginCandidate {
  name: string;
  uri?: string;
}

interface RoleSpec {
  role: string;
  preferred: string[];
  fallback?: string[];
  reason: string;
  parameterRanges: Record<string, { min: number; max: number; unit?: string }>;
}

export class PedalboardPlannerService {
  constructor(
    private readonly pluginService: PluginService,
    private readonly pedalboardService: PedalboardService
  ) {}

  async planFromPrompt(input: PedalboardPlanInput): Promise<PedalboardPlan> {
    const pluginList = await this.pluginService.listPlugins("both");
    const plugins = pluginList.plugins.map((plugin) => ({
      name: plugin.name ?? plugin.uri ?? "",
      uri: plugin.uri
    }));
    const pedalboards = await this.pedalboardService.listPedalboards("all");
    const template = this.chooseTemplate(
      pedalboards.user.length > 0 ? pedalboards.user : pedalboards.factory
    );
    const roles = this.rolesFor(input);
    const unsupportedIdeas: string[] = [];

    const signalChain = roles.flatMap((role, index) => {
      const selected =
        this.pickPlugin(plugins, role.preferred) ?? this.pickPlugin(plugins, role.fallback ?? []);
      if (!selected) {
        unsupportedIdeas.push(`No installed plugin found for role: ${role.role}`);
        return [];
      }
      return [this.toPlannedPlugin(role, selected, index)];
    });

    return {
      dryRun: true,
      safety: {
        writesFiles: false,
        modifiesDevice: false,
        callsPostEndpoints: false
      },
      request: input,
      template: template
        ? {
            title: template.title,
            bundlePath: template.bundlePath,
            source: template.source,
            reason: "Selected as a simple existing bundle to mirror MOD pedalboard structure."
          }
        : null,
      availablePluginCount: pluginList.count,
      signalChain,
      snapshots: this.proposeSnapshots(input, signalChain),
      notes: [
        "Dry-run plan only; no files were written and no POST/PUT/PATCH/DELETE endpoints were called.",
        "Only installed plugins returned by list_plugins are selected.",
        "Parameter ranges are starting ranges for a future generator, not live device settings."
      ],
      unsupportedIdeas
    };
  }

  private rolesFor(input: PedalboardPlanInput): RoleSpec[] {
    const text =
      `${input.style} ${input.instrument} ${input.goals.join(" ")} ${(input.referenceArtists ?? []).join(" ")}`.toLowerCase();
    const roles: RoleSpec[] = [];

    roles.push({
      role: "input gain",
      preferred: ["Gain", "Gain 2x2", "TinyGain Mono", "Volume"],
      reason: "Set level into the chain and provide simple global trim.",
      parameterRanges: { Gain: { min: -12, max: 6, unit: "dB" } }
    });

    if (matches(text, ["bass"])) {
      roles.push({
        role: "bass amp/cab character",
        preferred: ["GxSVT", "Bass Cabinets", "GxAlembic", "MOD Cabinet"],
        fallback: ["Cabinet Loader", "IR loader cabsim"],
        reason: "Bass-focused amp/cabinet stage for body and low-end shape.",
        parameterRanges: {
          BASS: { min: 0.35, max: 0.75 },
          MIDDLE: { min: 0.35, max: 0.7 },
          TREBLE: { min: 0.25, max: 0.65 }
        }
      });
    } else if (matches(text, ["high gain", "metal", "heavy", "distortion", "5150", "mesa"])) {
      roles.push({
        role: "high gain drive",
        preferred: [
          "Neural Amp Modeler",
          "AIDA-X",
          "MEGA California Recto",
          "GxSupersonic",
          "MetalTone"
        ],
        fallback: ["DS1", "Open Big Muff", "CollisionDrive"],
        reason: "Main saturation and amp-like gain stage for aggressive tones.",
        parameterRanges: {
          PREGAIN: { min: 0.2, max: 0.75 },
          MASTER: { min: -6, max: 3, unit: "dB" },
          BASS: { min: 0.35, max: 0.65 },
          MID: { min: -0.2, max: 0.25 },
          TREBLE: { min: -0.1, max: 0.35 }
        }
      });
      roles.push(cabinetRole());
    } else if (matches(text, ["clean", "ambient", "jazz", "post rock", "shoegaze"])) {
      roles.push({
        role: "clean tone shaper",
        preferred: ["GxAlembic", "GxCabinet", "MOD Cabinet", "Cabinet Loader"],
        fallback: ["Gain", "Gain 2x2"],
        reason: "Keeps the core tone clean while providing cabinet or preamp color.",
        parameterRanges: {
          Gain: { min: -6, max: 3, unit: "dB" }
        }
      });
    } else {
      roles.push({
        role: "core tone",
        preferred: ["AIDA-X", "Neural Amp Modeler", "GxCabinet", "MOD Cabinet", "Cabinet Loader"],
        fallback: ["Gain", "Gain 2x2"],
        reason: "General-purpose core tone stage based on installed plugins.",
        parameterRanges: { Gain: { min: -9, max: 6, unit: "dB" } }
      });
    }

    if (matches(text, ["compress", "tight", "funk", "bass", "clean"])) {
      roles.push({
        role: "dynamics",
        preferred: ["ZamComp", "GxCompressor", "Invada Compressor (mono)", "Calf Saturator"],
        reason: "Control transient range and keep the chain consistent.",
        parameterRanges: {
          threshold: { min: -36, max: -12, unit: "dB" },
          ratio: { min: 2, max: 6 },
          attack: { min: 0.001, max: 0.03, unit: "s" },
          release: { min: 0.05, max: 0.4, unit: "s" }
        }
      });
    }

    if (matches(text, ["chorus", "80s", "wide", "modulation", "swirl", "shoegaze"])) {
      roles.push({
        role: "modulation",
        preferred: [
          "TAP Chorus/Flanger",
          "Calf Flanger",
          "GxFlanger",
          "CS Chorus 1",
          "Triple chorus"
        ],
        reason: "Adds width and movement requested by the prompt.",
        parameterRanges: {
          rate: { min: 0.1, max: 1.5, unit: "Hz" },
          depth: { min: 0.15, max: 0.7 },
          mix: { min: 10, max: 45, unit: "%" }
        }
      });
    }

    if (matches(text, ["delay", "echo", "ambient", "lead", "solo", "dub", "post rock"])) {
      roles.push({
        role: "delay",
        preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Modulay", "Ping Pong Pan"],
        reason: "Provides repeat texture and time-based depth.",
        parameterRanges: {
          time: { min: 250, max: 650, unit: "ms" },
          feedback: { min: 15, max: 55, unit: "%" },
          mix: { min: 10, max: 40, unit: "%" }
        }
      });
    }

    if (matches(text, ["reverb", "ambient", "space", "shoegaze", "plate", "hall", "post rock"])) {
      roles.push({
        role: "reverb",
        preferred: [
          "Dragonfly Plate Reverb",
          "Dragonfly Hall Reverb",
          "MVerb",
          "Shiroverb",
          "TAL-Reverb-II"
        ],
        reason: "Adds the requested space and tail character.",
        parameterRanges: {
          decay: { min: 1.2, max: 6.5, unit: "s" },
          mix: { min: 8, max: 45, unit: "%" }
        }
      });
    }

    roles.push({
      role: "output level",
      preferred: ["Gain 2x2", "Gain", "Volume", "TinyGain Stereo"],
      reason: "Final trim before hardware outputs.",
      parameterRanges: { Gain: { min: -12, max: 0, unit: "dB" } }
    });

    return dedupeRoles(roles);
  }

  private pickPlugin(plugins: PluginCandidate[], preferred: string[]): PluginCandidate | null {
    for (const target of preferred) {
      const normalized = normalize(target);
      const found = plugins.find(
        (plugin) =>
          normalize(plugin.name).includes(normalized) ||
          normalize(plugin.uri ?? "").includes(normalized)
      );
      if (found) return found;
    }
    return null;
  }

  private toPlannedPlugin(role: RoleSpec, selected: PluginCandidate, index: number): PlannedPlugin {
    return {
      role: role.role,
      name: selected.name,
      uri: selected.uri,
      reason: role.reason,
      suggestedInstance: `${slug(role.role)}_${index + 1}`,
      parameterRanges: role.parameterRanges
    };
  }

  private chooseTemplate(
    pedalboards: Array<{ title: string | null; bundlePath: string; source: "user" | "factory" }>
  ) {
    return (
      pedalboards.find((pedalboard) =>
        /default|basic|simple|gain/i.test(`${pedalboard.title ?? ""} ${pedalboard.bundlePath}`)
      ) ??
      pedalboards[0] ??
      null
    );
  }

  private proposeSnapshots(
    input: PedalboardPlanInput,
    signalChain: PlannedPlugin[]
  ): PlannedSnapshot[] {
    const hasDelay = signalChain.some((plugin) => plugin.role === "delay");
    const hasReverb = signalChain.some((plugin) => plugin.role === "reverb");
    const hasDrive = signalChain.some((plugin) => /drive|gain|core tone/.test(plugin.role));

    const snapshots: PlannedSnapshot[] = [
      {
        name: "Base",
        description: `Balanced ${input.instrument} ${input.style} tone.`,
        parameterFocus: {
          gain: "moderate input/output levels",
          dynamics: "transparent control"
        }
      }
    ];

    if (hasDrive) {
      snapshots.push({
        name: "Drive",
        description: "More saturation and presence for stronger sections.",
        parameterFocus: { drive: "upper half of proposed gain range", output: "trim to unity" }
      });
    }
    if (hasDelay || hasReverb) {
      snapshots.push({
        name: "Ambient",
        description: "Wider time-based texture for intros, tails, or transitions.",
        parameterFocus: { delay: "higher feedback/mix", reverb: "longer decay and higher mix" }
      });
    }
    snapshots.push({
      name: "Lead",
      description: "Slight level lift and more time-based support.",
      parameterFocus: { output: "+2 to +4 dB if available", delay: "medium mix" }
    });

    return snapshots;
  }
}

function matches(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cabinetRole(): RoleSpec {
  return {
    role: "cabinet",
    preferred: [
      "Cabinet Loader",
      "IR loader cabsim",
      "MOD Cabinet",
      "Modern Cabinets",
      "Vintage Cabinets"
    ],
    reason: "Cabinet/IR stage after amp or drive processing.",
    parameterRanges: {
      level: { min: -18, max: -3, unit: "dB" },
      Gain: { min: -24, max: -6, unit: "dB" }
    }
  };
}

function dedupeRoles(roles: RoleSpec[]): RoleSpec[] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    if (seen.has(role.role)) return false;
    seen.add(role.role);
    return true;
  });
}
