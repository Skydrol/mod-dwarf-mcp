import type {
  PedalboardPlan,
  PedalboardPlanInput,
  PlannedPlugin,
  PlannedSnapshot
} from "../types/plan.js";
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
  constructor(private readonly pluginService: PluginService) {}

  async planFromPrompt(input: PedalboardPlanInput): Promise<PedalboardPlan> {
    const pluginList = await this.pluginService.listPlugins("both");
    const plugins = pluginList.plugins.map((plugin) => ({
      name: plugin.name ?? plugin.uri ?? "",
      uri: plugin.uri
    }));
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
      template: null,
      availablePluginCount: pluginList.count,
      signalChain,
      snapshots: this.proposeSnapshots(input, signalChain),
      notes: [
        "Dry-run plan only; no files were written and no POST/PUT/PATCH/DELETE endpoints were called.",
        "Only plugins present in the bundled local catalog are selected in the normal flow.",
        "Parameter ranges are starting ranges for a future generator, not live device settings."
      ],
      unsupportedIdeas
    };
  }

  private rolesFor(input: PedalboardPlanInput): RoleSpec[] {
    const text =
      `${input.style} ${input.instrument} ${input.goals.join(" ")} ${(input.referenceArtists ?? []).join(" ")}`.toLowerCase();
    const isLetItHappenBoard = matches(text, ["tame impala", "let it happen"]);
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
    } else if (isLetItHappenBoard) {
      roles.push({
        role: "core tone",
        preferred: ["Gain", "Gain 2x2", "TinyGain Mono", "AIDA-X", "Neural Amp Modeler"],
        fallback: ["Volume", "TinyGain Stereo"],
        reason: "Song-safe clean gain staging before modulation, delay, and reverb.",
        parameterRanges: { Gain: { min: -9, max: 4, unit: "dB" } }
      });
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

    if (isLetItHappenBoard) {
      roles.push({
        role: "modulation",
        preferred: [
          "TAP Chorus/Flanger",
          "Calf Flanger",
          "GxFlanger",
          "CS Chorus 1",
          "Triple chorus"
        ],
        reason: "Tame Impala style width and drift for the song arrangement.",
        parameterRanges: {
          rate: { min: 0.15, max: 1.2, unit: "Hz" },
          depth: { min: 0.2, max: 0.8 },
          mix: { min: 12, max: 50, unit: "%" }
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

    if (isLetItHappenBoard) {
      roles.push({
        role: "delay",
        preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Modulay", "Ping Pong Pan"],
        reason: "Song-specific delay wash and rhythmic repeats for Let It Happen sections.",
        parameterRanges: {
          time: { min: 280, max: 720, unit: "ms" },
          feedback: { min: 18, max: 62, unit: "%" },
          mix: { min: 12, max: 44, unit: "%" }
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

    if (isLetItHappenBoard) {
      roles.push({
        role: "reverb",
        preferred: [
          "Dragonfly Hall Reverb",
          "Dragonfly Plate Reverb",
          "MVerb",
          "Shiroverb",
          "TAL-Reverb-II"
        ],
        reason: "Adds a wide atmospheric tail to match the song's expansive sections.",
        parameterRanges: {
          decay: { min: 1.8, max: 7.5, unit: "s" },
          mix: { min: 10, max: 38, unit: "%" }
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
  private proposeSnapshots(
    input: PedalboardPlanInput,
    signalChain: PlannedPlugin[]
  ): PlannedSnapshot[] {
    const text =
      `${input.style} ${input.instrument} ${input.goals.join(" ")} ${(input.referenceArtists ?? []).join(" ")}`.toLowerCase();
    const isLetItHappenBoard = matches(text, ["tame impala", "let it happen"]);
    const hasDelay = signalChain.some((plugin) => plugin.role === "delay");
    const hasReverb = signalChain.some((plugin) => plugin.role === "reverb");
    const hasDrive = signalChain.some((plugin) => /drive|gain|core tone/.test(plugin.role));

    if (isLetItHappenBoard) {
      const snapshots: PlannedSnapshot[] = [
        {
          name: "Intro Drift",
          description: "Soft, wide shimmer with restrained saturation and long space.",
          parameterFocus: {
            modulation: "gentle width and slow motion",
            delay: "low mix with audible repeats",
            reverb: "long tail, lower mix"
          }
        },
        {
          name: "Verse Pulse",
          description: "Tighter pulse with enough movement to keep the riff alive.",
          parameterFocus: {
            gain: "slightly stronger input drive",
            modulation: "medium depth",
            delay: "medium feedback and mix"
          }
        },
        {
          name: "Chorus Bloom",
          description: "Wider, more obvious modulation and delay for the big section.",
          parameterFocus: {
            modulation: "higher mix and depth",
            delay: "bigger repeats",
            reverb: "noticeable wash"
          }
        },
        {
          name: "Bridge Collapse",
          description: "Pulls back the core level while letting the ambience hang.",
          parameterFocus: {
            gain: "slightly reduced output",
            delay: "wider feedback spread",
            reverb: "more tail than earlier snapshots"
          }
        },
        {
          name: "Lead Lift",
          description: "Ends with the most forward and open version of the chain.",
          parameterFocus: {
            gain: "small level lift if available",
            delay: "balanced mix",
            reverb: "full but controlled tail"
          }
        }
      ];
      return snapshots;
    }

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
