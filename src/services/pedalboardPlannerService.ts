import type {
  PedalboardPlan,
  PedalboardPlanInput,
  PedalboardOperationMode,
  PlannedPlugin,
  PlannedSnapshot
} from "../types/plan.js";
import type { PluginService } from "./pluginService.js";
import { PluginKnowledgeDbService } from "./pluginKnowledgeDbService.js";
import { PedalboardSafetyService } from "./pedalboardSafetyService.js";
import { RoleParameterProfileService } from "./roleParameterProfileService.js";

interface PluginCandidate {
  name: string;
  uri?: string;
}

interface RoleSpec {
  role: string;
  preferred: string[];
  reason: string;
  requiresProfile?: boolean;
}

export class PedalboardPlannerService {
  constructor(
    private readonly pluginService: PluginService,
    private readonly knowledgeDbService: PluginKnowledgeDbService = new PluginKnowledgeDbService(),
    private readonly profileService: RoleParameterProfileService = new RoleParameterProfileService(),
    private readonly safetyService: PedalboardSafetyService = new PedalboardSafetyService()
  ) {}

  async planFromPrompt(input: PedalboardPlanInput): Promise<PedalboardPlan> {
    const promptText = promptTextFor(input);
    const operationMode = this.decideOperationMode(promptText);
    const pluginList = await this.pluginService.listPlugins("both");
    const knowledgeDb = await this.knowledgeDbService.load();
    const plugins = pluginList.plugins.map((plugin) => ({
      name: plugin.name ?? plugin.uri ?? "",
      uri: plugin.uri
    }));
    const roles = this.rolesFor(input);
    const unsupportedIdeas: string[] = [];
    const profileWarnings: string[] = [];

    const resolved = await Promise.all(
      roles.map(async (role, index) => {
        const selected = this.pickPlugin(plugins, role.preferred, knowledgeDb);
        if (!selected) {
          unsupportedIdeas.push(`No installed plugin found for role: ${role.role}`);
          return null;
        }

        const ports = selected.uri
          ? await this.pluginService.getPluginPorts(selected.uri)
          : { uri: "", ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
        const profile = this.profileService.resolve(
          role.role,
          selected.name,
          selected.uri,
          ports,
          promptText
        );

        unsupportedIdeas.push(...profile.unsupportedIdeas);
        profileWarnings.push(...profile.warnings);

        if (role.requiresProfile && !profile.valid) {
          unsupportedIdeas.push(
            `No valid controllable profile found for role: ${role.role} on ${selected.name}`
          );
          return null;
        }

        return this.toPlannedPlugin(role, selected, index, profile.parameterRanges);
      })
    );

    const signalChain = resolved.filter((plugin): plugin is PlannedPlugin => Boolean(plugin));

    const basePlan: PedalboardPlan = {
      dryRun: true,
      operationMode,
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

    const safety = this.safetyService.adjustPlan(basePlan);
    const safetyNotes = [
      ...dedupe(profileWarnings).map((warning) => `Role profile warning: ${warning}`),
      ...safety.warnings.map((warning) => `Safety warning: ${warning}`),
      ...(safety.adjustments.length > 0
        ? [
            `Safety adjustments applied: ${safety.adjustments
              .map(
                (adjustment) =>
                  `${adjustment.plugin}/${adjustment.parameter} (${formatRange(
                    adjustment.originalValue
                  )} -> ${formatRange(adjustment.adjustedValue)})`
              )
              .join("; ")}`
          ]
        : [])
    ];

    return {
      ...safety.adjustedPlan,
      notes: [...basePlan.notes, ...safetyNotes]
    };
  }

  private decideOperationMode(promptText: string): PedalboardOperationMode {
    const text = promptText.toLowerCase();
    if (matches(text, ["parameter only", "just change parameters", "change parameters only"])) {
      return "parameter_only";
    }

    if (matches(text, ["modify current board", "keep current board", "adjust current board"])) {
      return "modify_current_board";
    }

    if (matches(text, ["replace current board", "replace the current board", "start over"])) {
      return "replace_current_board";
    }

    if (matches(text, [
      "new board",
      "new pedalboard",
      "create a board",
      "create pedalboard",
      "build a board",
      "build pedalboard"
    ])) {
      return "new_board";
    }

    if (matches(text, ["add ", "add a ", "add an ", "insert ", "append ", "include "])) {
      return "modify_current_board";
    }

    return "replace_current_board";
  }

  private rolesFor(input: PedalboardPlanInput): RoleSpec[] {
    const text = promptTextFor(input);
    const isU2NewYearsDay = matches(text, ["u2", "new year's day", "new years day"]);
    const isComfortablyNumb = matches(text, ["comfortably numb", "david gilmour", "pink floyd"]);
    const isMasterOfPuppets = matches(text, ["master of puppets", "metallica"]);
    const isElephant = matches(text, ["elephant"]);
    const isSigurRos = matches(text, ["sigur ros", "sigur rós"]);
    const isKhruangbin = matches(text, ["khruangbin"]);
    const isTomMorello = matches(text, ["tom morello"]);
    const isShoegaze = matches(text, ["shoegaze"]);
    const isModernRockBass = matches(text, ["modern rock bass", "bass guitar"]);
    const isShineOn = matches(text, ["shine on you crazy diamond"]);
    const isLetItHappenBoard = matches(text, ["let it happen"]);
    const isSmellsLikeTeenSpirit = matches(text, ["smells like teen spirit", "nirvana"]);
    const isSaturationReduction = false;
    const toneComplaint = classifyToneComplaint(text);
    const wantsSelfOscillation = matches(text, [
      "maximum feedback",
      "infinite",
      "self oscillating",
      "self-oscillating"
    ]);
    const roles: RoleSpec[] = [];

    if (isSmellsLikeTeenSpirit) {
      return [
        {
          role: "high gain drive",
          preferred: ["AIDA-X", "Distortion", "Big Muff", "ChowCentaur"],
          reason: "Primary Nirvana-style distortion with the closest installed substitute first.",
          requiresProfile: true
        },
        {
          role: "modulation",
          preferred: ["CS Chorus 1", "TAP Chorus/Flanger", "Calf Flanger", "GxFlanger"],
          reason: "Small Clone-style chorus approximation for Smells Like Teen Spirit.",
          requiresProfile: true
        }
      ];
    }

    if (isSaturationReduction) {
      return dedupeRoles([
        {
          role: "input gain",
          preferred: ["Gain", "Gain 2x2", "TinyGain Mono", "Volume"],
          reason: "Lower the level hitting the chain to reduce saturation.",
          requiresProfile: true
        },
        {
          role: "output level",
          preferred: ["Gain 2x2", "Gain", "Volume", "TinyGain Stereo"],
          reason: "Bring the overall level back to a controlled output after reducing drive.",
          requiresProfile: true
        }
      ]);
    }

    if (toneComplaint === "harsh") {
      return dedupeRoles([
        {
          role: "output level",
          preferred: ["Gain 2x2", "Gain", "Volume", "TinyGain Stereo"],
          reason: "Reduce the top-end bite and overall level before the output stage.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "If present, soften harshness with a controlled space tail.",
          requiresProfile: true
        }
      ]);
    }

    if (toneComplaint === "muddy") {
      return dedupeRoles([
        {
          role: "input gain",
          preferred: ["Gain", "Gain 2x2", "TinyGain Mono", "Volume"],
          reason: "Tighten the front of the chain and reduce excessive low-end buildup.",
          requiresProfile: true
        },
        {
          role: "cabinet",
          preferred: ["Vintage Cabinets", "MOD Cabinet", "GxCabinet", "Cabinet Loader"],
          reason: "Keep the body controlled while restoring definition.",
          requiresProfile: true
        }
      ]);
    }

    if (toneComplaint === "echoing") {
      return dedupeRoles([
        {
          role: "delay",
          preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Modulay", "Ping Pong Pan"],
          reason: "Reduce or reshape repeat-heavy echo behavior.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Control the ambient tail so the sound does not wash out.",
          requiresProfile: true
        }
      ]);
    }

    if (isElephant) {
      return dedupeRoles([
        {
          role: "fuzz",
          preferred: ["Big Muff", "GxSuperFuzz", "Fuzz", "GxFuzzFaceFullerMod"],
          reason: "Core fuzzy riff texture for Elephant.",
          requiresProfile: false
        },
        {
          role: "high gain drive",
          preferred: ["AIDA-X", "DS1", "GxSD1", "ChowCentaur"],
          reason: "Aggressive drive or amp-like push behind the fuzz.",
          requiresProfile: true
        },
        cabinetRole()
      ]);
    }

    if (isU2NewYearsDay) {
      return dedupeRoles([
        {
          role: "clean tone shaper",
          preferred: ["Gain", "Gain 2x2", "TinyGain Stereo", "Volume"],
          reason: "Keeps the core tone clean and articulate for the intro and verse.",
          requiresProfile: false
        },
        {
          role: "modulation",
          preferred: ["TAP Chorus/Flanger", "CS Chorus 1", "Phaser", "GxFlanger"],
          reason: "Subtle chorus width for the song's signature guitar texture.",
          requiresProfile: true
        },
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Rhythmic echo support for the spacious parts.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Adds the ambient tail that supports the wide U2-style sound.",
          requiresProfile: true
        }
      ]);
    }

    if (isComfortablyNumb) {
      return dedupeRoles([
        {
          role: "dynamics",
          preferred: ["ZamComp", "Compressor St", "Compressor M", "GxCompressor"],
          reason: "Smooths the front of the guitar tone for Gilmour-style sustain.",
          requiresProfile: false
        },
        {
          role: "high gain drive",
          preferred: ["AIDA-X", "DS1", "GxSD1", "ChowCentaur"],
          reason: "Moderate lead drive for the song's saturated passages.",
          requiresProfile: true
        },
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Spacious repeats for the solo lines.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "Plate Reverb", "TAL-Reverb-II"],
          reason: "Wide ambient tail supporting the lead tone.",
          requiresProfile: true
        }
      ]);
    }

    if (isMasterOfPuppets) {
      return dedupeRoles([
        {
          role: "high gain drive",
          preferred: ["AIDA-X", "DS1", "GxSD1", "GxTubeScreamer", "Big Muff"],
          reason: "Aggressive rhythm saturation for the iconic thrash tone.",
          requiresProfile: true
        },
        cabinetRole()
      ]);
    }

    if (isSigurRos) {
      return dedupeRoles([
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Long, spacious repeats for the ambient bed.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Huge washed tail for Sigur Ros-style ambience.",
          requiresProfile: true
        },
        {
          role: "modulation",
          preferred: ["TAP Chorus/Flanger", "CS Chorus 1", "Phaser", "GxFlanger"],
          reason: "Slow movement and shimmer in the texture.",
          requiresProfile: true
        }
      ]);
    }

    if (isKhruangbin) {
      return dedupeRoles([
        {
          role: "dynamics",
          preferred: ["ZamComp", "Compressor St", "Compressor M", "GxCompressor"],
          reason: "Keeps the clean funk attack even and controlled.",
          requiresProfile: false
        },
        {
          role: "clean tone shaper",
          preferred: ["Gain", "Gain 2x2", "TinyGain Stereo", "Volume"],
          reason: "Clean core tone for articulate psychedelic funk playing.",
          requiresProfile: false
        },
        {
          role: "modulation",
          preferred: ["TAP Chorus/Flanger", "CS Chorus 1", "Phaser", "GxPhaser"],
          reason: "Subtle psychedelic movement without high gain.",
          requiresProfile: true
        }
      ]);
    }

    if (isTomMorello) {
      return dedupeRoles([
        {
          role: "high gain drive",
          preferred: ["AIDA-X", "DS1", "GxSD1", "GxTubeScreamer", "Big Muff"],
          reason: "Distinctive rock drive as the core of the tone.",
          requiresProfile: true
        },
        {
          role: "wah",
          preferred: ["WAH-1", "Pedal Taster", "Wah", "Kuiza"],
          reason: "Optional rhythmic wah filtering for Morello-style sounds.",
          requiresProfile: false
        },
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Optional delay for lead textures and rhythmic accents.",
          requiresProfile: true
        }
      ]);
    }

    if (isShoegaze) {
      return dedupeRoles([
        {
          role: "drive",
          preferred: ["AIDA-X", "Big Muff", "Fuzz", "GxSuperFuzz"],
          reason: "Thick fuzz for the wall-of-sound layer.",
          requiresProfile: true
        },
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Long repeats and diffusion for the wash.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Huge space to blur the guitar texture.",
          requiresProfile: true
        },
        {
          role: "modulation",
          preferred: ["TAP Chorus/Flanger", "CS Chorus 1", "Phaser", "GxFlanger"],
          reason: "Extra width and motion in the ambient wall.",
          requiresProfile: true
        }
      ]);
    }

    if (isModernRockBass) {
      return dedupeRoles([
        {
          role: "dynamics",
          preferred: ["ZamComp", "GxCompressor", "Compressor St", "Compressor M"],
          reason: "Even bass level and better note definition.",
          requiresProfile: true
        },
        {
          role: "bass amp/cab character",
          preferred: ["Vintage Cabinets", "MOD Cabinet", "GxAlembic", "Cabinet Loader"],
          reason: "Bass-focused low-end body and speaker shape.",
          requiresProfile: true
        }
      ]);
    }

    if (matches(text, ["self oscillating"])) {
      return dedupeRoles([
        {
          role: "feedback-capable delay",
          preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Delay Munge ST", "Modulay"],
          reason: "Delay chosen specifically for safe feedback-heavy oscillation behavior.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Ambient tail to support the oscillating delay bed.",
          requiresProfile: true
        }
      ]);
    }

    if (isShineOn) {
      return dedupeRoles([
        {
          role: "dynamics",
          preferred: ["ZamComp", "GxCompressor", "Compressor St", "Compressor M"],
          reason: "Keeps the clean guitar line even and musical.",
          requiresProfile: true
        },
        {
          role: "clean tone",
          preferred: ["Gain", "Gain 2x2", "Vintage Cabinets", "MOD Cabinet"],
          reason: "Clean core tone for the melody and harmony parts.",
          requiresProfile: true
        },
        {
          role: "delay",
          preferred: ["TAP Stereo Echo", "Bollie Delay", "MDA DubDelay", "Delay Munge ST"],
          reason: "Long delay support for the lead lines.",
          requiresProfile: true
        },
        {
          role: "reverb",
          preferred: ["Dragonfly Hall Reverb", "MVerb", "TAL-Reverb-II", "Shiroverb"],
          reason: "Large reverb tail for the spacious Pink Floyd sound.",
          requiresProfile: true
        }
      ]);
    }

    roles.push({
      role: "input gain",
      preferred: ["Gain", "Gain 2x2", "TinyGain Mono", "Volume"],
      reason: "Set level into the chain and provide simple global trim.",
      requiresProfile: true
    });

    if (matches(text, ["bass"])) {
      roles.push({
        role: "bass amp/cab character",
        preferred: ["Vintage Cabinets", "MOD Cabinet", "GxAlembic", "Cabinet Loader"],
        reason: "Bass-focused amp/cabinet stage for body and low-end shape.",
        requiresProfile: true
      });
    } else if (matches(text, ["high gain", "metal", "heavy", "distortion", "5150", "mesa"])) {
      roles.push({
        role: "high gain drive",
        preferred: ["AIDA-X", "Neural Amp Modeler", "MEGA California Recto", "GxSupersonic"],
        reason: "Main saturation and amp-like gain stage for aggressive tones.",
        requiresProfile: true
      });
      roles.push(cabinetRole());
    } else if (isLetItHappenBoard) {
      // Let It Happen works best as a single-gain, effects-forward chain.
    } else if (matches(text, ["clean", "ambient", "jazz", "post rock", "shoegaze", "funk"])) {
      roles.push({
        role: "clean tone shaper",
        preferred: ["Vintage Cabinets", "GxCabinet", "MOD Cabinet"],
        reason: "Keeps the core tone controlled while providing cabinet or preamp color.",
        requiresProfile: true
      });
    } else {
      roles.push({
        role: "core tone",
        preferred: ["AIDA-X", "Neural Amp Modeler", "Vintage Cabinets", "GxCabinet", "MOD Cabinet"],
        reason: "General-purpose core tone stage based on installed plugins.",
        requiresProfile: true
      });
    }

    if (matches(text, ["compress", "tight", "funk", "bass", "clean"])) {
      roles.push({
        role: "dynamics",
        preferred: ["ZamComp", "GxCompressor", "Invada Compressor (mono)"],
        reason: "Control transient range and keep the chain consistent.",
        requiresProfile: true
      });
    }

    if (matches(text, ["chorus", "80s", "wide", "modulation", "swirl", "shoegaze"])) {
      roles.push({
        role: "modulation",
        preferred: ["TAP Chorus/Flanger", "Calf Flanger", "GxFlanger", "CS Chorus 1"],
        reason: "Adds width and movement requested by the prompt.",
        requiresProfile: true
      });
    }

    if (isLetItHappenBoard) {
      roles.push({
        role: "modulation",
        preferred: ["TAP Chorus/Flanger", "Calf Flanger", "GxFlanger", "CS Chorus 1"],
        reason: "Tame Impala style width and drift for the song arrangement.",
        requiresProfile: true
      });
    }

    if (matches(text, ["delay", "echo", "ambient", "lead", "solo", "dub", "post rock"])) {
      roles.push({
        role: wantsSelfOscillation ? "feedback-capable delay" : "delay",
        preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Modulay", "Ping Pong Pan"],
        reason: wantsSelfOscillation
          ? "Feedback-heavy delay wash interpreted safely for the requested patch."
          : "Provides repeat texture and time-based depth.",
        requiresProfile: true
      });
    }

    if (isLetItHappenBoard) {
      roles.push({
        role: "delay",
        preferred: ["Bollie Delay", "TAP Stereo Echo", "MDA DubDelay", "Modulay", "Ping Pong Pan"],
        reason: "Song-specific delay wash and rhythmic repeats for Let It Happen sections.",
        requiresProfile: true
      });
    }

    if (matches(text, ["reverb", "ambient", "space", "shoegaze", "plate", "hall", "post rock"])) {
      roles.push({
        role: "reverb",
        preferred: [
          "Dragonfly Hall Reverb",
          "Dragonfly Plate Reverb",
          "MVerb",
          "Shiroverb",
          "TAL-Reverb-II"
        ],
        reason: "Adds the requested space and tail character.",
        requiresProfile: true
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
        requiresProfile: true
      });
    }

    roles.push({
      role: "output level",
      preferred: ["Gain 2x2", "Gain", "Volume", "TinyGain Stereo"],
      reason: "Final trim before hardware outputs.",
      requiresProfile: true
    });

    return dedupeRoles(roles);
  }

  private pickPlugin(
    plugins: PluginCandidate[],
    preferred: string[],
    knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
  ): PluginCandidate | null {
    const scored = plugins
      .map((plugin) => ({
        plugin,
        score: scorePluginCandidate(plugin, preferred, knowledgeDb)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.plugin.name.localeCompare(right.plugin.name));
    return scored[0]?.plugin ?? null;
  }

  private toPlannedPlugin(
    role: RoleSpec,
    selected: PluginCandidate,
    index: number,
    parameterRanges: Record<string, { min: number; max: number; unit?: string }>
  ): PlannedPlugin {
    return {
      role: role.role,
      name: selected.name,
      uri: selected.uri,
      reason: role.reason,
      suggestedInstance: `${slug(role.role)}_${index + 1}`,
      parameterRanges
    };
  }

  private proposeSnapshots(
    input: PedalboardPlanInput,
    signalChain: PlannedPlugin[]
  ): PlannedSnapshot[] {
    const text = promptTextFor(input);
    if (matches(text, ["new year's day", "new years day"])) {
      return [
        {
          name: "Intro",
          description: "Clean intro with subtle chorus and space.",
          parameterFocus: { modulation: "subtle", delay: "light repeats", reverb: "moderate hall" }
        },
        {
          name: "Verse",
          description: "Rhythmic verse with clear delay tails.",
          parameterFocus: { modulation: "subtle width", delay: "more audible repeats", reverb: "controlled tail" }
        },
        {
          name: "Lead",
          description: "Forward lead with the same core clean texture.",
          parameterFocus: { modulation: "slightly wider", delay: "lifted repeats", reverb: "more space" }
        }
      ];
    }
    if (matches(text, ["comfortably numb"])) {
      return [
        {
          name: "Clean",
          description: "Clean guitar foundation with compression and space.",
          parameterFocus: { dynamics: "even level", delay: "supporting repeats", reverb: "moderate hall" }
        },
        {
          name: "Solo",
          description: "Singing lead with more sustain and echo.",
          parameterFocus: { drive: "more present", delay: "clear lead echo", reverb: "bigger tail" }
        },
        {
          name: "Big Solo",
          description: "Largest lead voice with wide ambience.",
          parameterFocus: { drive: "strongest lead sustain", delay: "broader repeats", reverb: "wide and long" }
        }
      ];
    }
    if (matches(text, ["master of puppets"])) {
      return [
        {
          name: "Rhythm",
          description: "Tight thrash rhythm tone.",
          parameterFocus: { drive: "tight high gain", cabinet: "tight low-end" }
        },
        {
          name: "Lead",
          description: "Lead lift with the same aggressive core.",
          parameterFocus: { drive: "slightly hotter", cabinet: "focused" }
        }
      ];
    }
    if (matches(text, ["sigur ros", "sigur rós"])) {
      return [
        {
          name: "Atmosphere",
          description: "Wide ambient wash.",
          parameterFocus: { delay: "long repeats", reverb: "huge tail" }
        },
        {
          name: "Swell",
          description: "Building ambient texture.",
          parameterFocus: { modulation: "slow movement", reverb: "larger wash" }
        },
        {
          name: "Massive Wall",
          description: "Largest ambient section.",
          parameterFocus: { delay: "dense repeats", reverb: "maximum space" }
        }
      ];
    }
    if (matches(text, ["khruangbin"])) {
      return [
        {
          name: "Clean",
          description: "Clean and articulate.",
          parameterFocus: { dynamics: "tight", modulation: "subtle" }
        },
        {
          name: "Funk",
          description: "Rhythmic clean funk accent.",
          parameterFocus: { dynamics: "controlled", modulation: "more movement" }
        },
        {
          name: "Psychedelic",
          description: "Wider psychedelic texture.",
          parameterFocus: { modulation: "more obvious", delay: "light support" }
        }
      ];
    }
    if (matches(text, ["tom morello"])) {
      return [
        {
          name: "Rhythm",
          description: "Primary riffing tone.",
          parameterFocus: { drive: "present", output: "steady" }
        },
        {
          name: "Solo",
          description: "Lead or effect-heavy section.",
          parameterFocus: { drive: "more aggressive", delay: "optional support" }
        }
      ];
    }
    if (matches(text, ["shoegaze"])) {
      return [
        {
          name: "Clean Wash",
          description: "Start with haze and width.",
          parameterFocus: { delay: "moderate wash", reverb: "wide tail" }
        },
        {
          name: "Wall Of Sound",
          description: "Dense layered guitar cloud.",
          parameterFocus: { drive: "stronger", delay: "deeper wash", reverb: "bigger tail" }
        },
        {
          name: "Infinite Atmosphere",
          description: "Largest and longest ambient section.",
          parameterFocus: { delay: "maximum repeats", reverb: "maximum space" }
        }
      ];
    }
    if (matches(text, ["bass guitar", "modern rock bass"])) {
      return [
        {
          name: "Base",
          description: "Core bass tone with control.",
          parameterFocus: { dynamics: "steady", cabinet: "present" }
        },
        {
          name: "Drive",
          description: "A bit more grit for heavy parts.",
          parameterFocus: { drive: "slightly pushed", cabinet: "kept tight" }
        }
      ];
    }
    if (matches(text, ["self oscillating"])) {
      return [
        {
          name: "Ambient",
          description: "Initial ambient delay bloom.",
          parameterFocus: { delay: "high feedback", reverb: "supportive" }
        },
        {
          name: "Oscillation",
          description: "Feedback-heavy section.",
          parameterFocus: { delay: "near oscillation", reverb: "controlled" }
        }
      ];
    }
    if (matches(text, ["shine on you crazy diamond"])) {
      return [
        {
          name: "Intro",
          description: "Clean opening texture.",
          parameterFocus: { dynamics: "even", delay: "supportive", reverb: "wide" }
        },
        {
          name: "Verse",
          description: "Main guitar phrase.",
          parameterFocus: { delay: "present", reverb: "space" }
        },
        {
          name: "Solo",
          description: "Lead lift.",
          parameterFocus: { drive: "slightly hotter", delay: "clear repeats", reverb: "bigger tail" }
        },
        {
          name: "Outro",
          description: "Closing ambient fade.",
          parameterFocus: { delay: "long", reverb: "wide and long" }
        }
      ];
    }
    if (
      matches(text, [
        "saturation",
        "lower saturation",
        "less saturation",
        "reduce saturation",
        "too saturated",
        "dial back saturation",
        "turn down saturation"
      ])
    ) {
      return [
        {
          name: "Reduced Saturation",
          description: "Pull back the level and tame the drive without changing the chain.",
          parameterFocus: { gain: "lower input drive", output: "slightly lower level" }
        }
      ];
    }
    const isLetItHappenBoard = matches(text, ["let it happen"]);
    const isSmellsLikeTeenSpirit = matches(text, ["smells like teen spirit", "nirvana"]);
    const hasDelay = signalChain.some((plugin) => plugin.role === "delay");
    const hasReverb = signalChain.some((plugin) => plugin.role === "reverb");
    const hasDrive = signalChain.some((plugin) => /drive|gain|core tone/.test(plugin.role));

    if (isSmellsLikeTeenSpirit) {
      return [
        {
          name: "Verse",
          description: "Chorus-forward crunch with restrained output.",
          parameterFocus: {
            drive: "moderate distortion",
            modulation: "subtle chorus",
            output: "unity gain"
          }
        },
        {
          name: "Chorus",
          description: "Bigger attack and a wider chorus texture.",
          parameterFocus: {
            drive: "slightly hotter drive",
            modulation: "more obvious width",
            output: "trim to avoid clipping"
          }
        },
        {
          name: "Lead",
          description: "Forward guitar with the same core tone and a little more lift.",
          parameterFocus: {
            drive: "same distortion character",
            modulation: "kept on for width",
            output: "small level lift if available"
          }
        }
      ];
    }

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

function promptTextFor(input: PedalboardPlanInput): string {
  return `${input.style} ${input.instrument} ${input.goals.join(" ")} ${(input.referenceArtists ?? []).join(" ")}`.toLowerCase();
}

function matches(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function classifyToneComplaint(text: string): "harsh" | "muddy" | "echoing" | null {
  if (
    matches(text, [
      "harsh",
      "harshness",
      "strident",
      "stridency",
      "bright",
      "brightness",
      "piercing",
      "shrill",
      "sharp"
    ])
  ) {
    return "harsh";
  }
  if (
    matches(text, [
      "muddy",
      "mud",
      "dirty",
      "blurred",
      "boomy",
      "muddy",
      "cloudy",
      "closed"
    ])
  ) {
    return "muddy";
  }
  if (
    matches(text, [
      "echoing",
      "too much echo",
      "too much reverb",
      "reverberant",
      "washed out",
      "too wet"
    ])
  ) {
    return "echoing";
  }
  return null;
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
    preferred: ["Vintage Cabinets", "Cabinet Loader", "MOD Cabinet", "GxCabinet"],
    reason: "Cabinet/IR stage after amp or drive processing.",
    requiresProfile: true
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

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatRange(range: { min: number; max: number; unit?: string }): string {
  const suffix = range.unit ? ` ${range.unit}` : "";
  return `${range.min}..${range.max}${suffix}`;
}

function scorePluginCandidate(
  plugin: PluginCandidate,
  preferred: string[],
  knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
): number {
  const normalizedName = normalize(plugin.name);
  const normalizedUri = normalize(plugin.uri ?? "");
  let score = 0;

  for (let index = 0; index < preferred.length; index += 1) {
    const target = normalize(preferred[index]);
    if (normalizedName === target || normalizedUri === target) {
      score += 100 - index * 5;
      break;
    }
  }

  const entry = knowledgeDb?.plugins.find(
    (item) => normalize(item.name) === normalizedName || normalize(item.uri) === normalizedUri
  );
  if (!entry) return score;

  const preferredRole = inferPreferredRoleFromCandidates(preferred);
  if (preferredRole && entry.roles.includes(preferredRole)) score += 25;
  if (preferredRole && entry.category === preferredRole) score += 15;
  if (entry.goodFor.length > 0) score += 2;
  if (entry.warnings.length > 0) score -= 1;
  if (entry.plannerNotes.length > 0) score += 1;

  return score;
}

function inferPreferredRoleFromCandidates(preferred: string[]): string | null {
  const joined = normalize(preferred.join(" "));
  if (joined.includes("reverb")) return "reverb";
  if (joined.includes("delay")) return "delay";
  if (joined.includes("chorus") || joined.includes("flanger") || joined.includes("mod")) return "modulation";
  if (joined.includes("compress")) return "dynamics";
  if (joined.includes("cab") || joined.includes("amp")) return "amp";
  if (joined.includes("gain") || joined.includes("volume")) return "utility";
  if (joined.includes("eq") || joined.includes("filter")) return "EQ";
  if (joined.includes("drive") || joined.includes("dist") || joined.includes("fuzz")) return "drive";
  return null;
}
