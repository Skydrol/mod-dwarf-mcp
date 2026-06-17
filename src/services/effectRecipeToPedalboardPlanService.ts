import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EffectRecipe, PedalboardPlan, PlannedPlugin, PlannedSnapshot } from "../types/plan.js";
import type { PluginService } from "./pluginService.js";
import type { PluginKnowledgeDbService } from "./pluginKnowledgeDbService.js";
import type { RoleParameterProfileService } from "./roleParameterProfileService.js";
import type { PedalboardSafetyService } from "./pedalboardSafetyService.js";

interface PluginCandidate {
  name: string;
  uri?: string;
}

interface DeviceInventoryFile {
  plugins?: Array<{ name?: string; uri?: string }>;
}

const DEFAULT_DEVICE_INVENTORY_PATH = "data/deviceInventory.json";

export class EffectRecipeToPedalboardPlanService {
  constructor(
    private readonly pluginService: PluginService,
    private readonly knowledgeDbService: PluginKnowledgeDbService,
    private readonly profileService: RoleParameterProfileService,
    private readonly safetyService: PedalboardSafetyService
  ) {}

  async convert(recipe: EffectRecipe): Promise<PedalboardPlan> {
    const pluginList = await this.pluginService.listPlugins("both");
    const knowledgeDb = await this.knowledgeDbService.load();
    const inventoryPlugins = await loadDeviceInventoryPlugins();
    const plugins = [
      ...pluginList.plugins
      .map((plugin) => ({ name: plugin.name ?? plugin.uri ?? "", uri: plugin.uri }))
      .filter((plugin) => plugin.name.length > 0),
      ...inventoryPlugins
    ];

    const chain = await this.buildChain(recipe, plugins, knowledgeDb);
    const snapshots = dedupeSnapshots(recipe.snapshots.map(recipeSnapshotToPlan));
    const snapshotNames = new Set(snapshots.map((snapshot) => snapshot.name));

    const basePlan: PedalboardPlan = {
      dryRun: true,
      operationMode: recipe.operationMode,
      safety: {
        writesFiles: false,
        modifiesDevice: false,
        callsPostEndpoints: false
      },
      request: {
        style: recipe.song ?? recipe.artist ?? "recipe",
        instrument: recipe.instrument,
        goals: recipe.effects.map((effect) => recipeEffectGoal(effect)),
        referenceArtists: recipe.artist ? [recipe.artist] : []
      },
      template: null,
      availablePluginCount: pluginList.count,
      signalChain: chain,
      snapshots,
      notes: [
        "Recipe-driven plan only; no files were written and no POST/PUT/PATCH/DELETE endpoints were called.",
        "Recipe effects are mapped directly to installed plugins where possible.",
        "Sections reuse snapshots by name; repeated sections do not duplicate snapshot definitions."
      ],
      unsupportedIdeas: []
    };

    const safety = this.safetyService.adjustPlan(basePlan);
    return {
      ...safety.adjustedPlan,
      notes: [
        ...safety.adjustedPlan.notes,
        ...(recipe.sections.length > 0
          ? recipe.sections.map(
              (section) => `Section '${section.name}' reuses snapshot '${section.snapshot}'.`
            )
          : []),
        ...(snapshotNames.size > 0
          ? [`Recipe snapshot count: ${snapshotNames.size}.`]
          : [])
      ]
    };
  }

  private async buildChain(
    recipe: EffectRecipe,
    plugins: PluginCandidate[],
    knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
  ): Promise<PlannedPlugin[]> {
    if (isElephantRecipe(recipe)) {
      return this.buildElephantChain(recipe, plugins, knowledgeDb);
    }

    const chain: PlannedPlugin[] = [];

    for (let index = 0; index < recipe.effects.length; index += 1) {
      const effect = recipe.effects[index];
      const selected = this.pickForRecipe(effect.role, effect.character, plugins, knowledgeDb);
      if (!selected) continue;

      const ports = selected.uri
        ? await this.pluginService.getPluginPorts(selected.uri)
        : { uri: "", ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
      const profile = this.profileService.resolve(
        recipeRoleToPlannerRole(effect.role),
        selected.name,
        selected.uri,
        ports,
        `${recipe.song ?? ""} ${recipe.artist ?? ""} ${effect.character}`
      );

      chain.push({
        role: effect.role,
        name: selected.name,
        uri: selected.uri,
        reason: effect.character,
        suggestedInstance: `${slug(effect.role)}_${index + 1}`,
        parameterRanges: profile.parameterRanges ?? {}
      });
    }

    return chain;
  }

  private async buildElephantChain(
    recipe: EffectRecipe,
    plugins: PluginCandidate[],
    _knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
  ): Promise<PlannedPlugin[]> {
    const chain: PlannedPlugin[] = [];
    const roles: Array<{ role: string; preferred: string[]; reason: string }> = [
      {
        role: "fuzz",
        preferred: ["Open Big Muff", "Big Muff", "GxSuperFuzz", "Fuzz", "GxFuzzFaceFullerMod"],
        reason: "Core fuzzy riff texture for Elephant."
      },
      {
        role: "high gain drive",
        preferred: ["AIDA-X", "DS1", "GxSD1", "ChowCentaur"],
        reason: "Aggressive drive or amp-like push behind the fuzz."
      },
      {
        role: "cabinet",
        preferred: ["Vintage Cabinets", "MOD Cabinet", "GxCabinet", "Cabinet Loader"],
        reason: "Cabinet stage for a dry, direct riff tone."
      }
    ];

    for (let index = 0; index < roles.length; index += 1) {
      const spec = roles[index];
      const selected = selectPreferredPlugin(plugins, spec.preferred);
      if (!selected) continue;

      const ports = selected.uri
        ? await this.pluginService.getPluginPorts(selected.uri)
        : { uri: "", ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
      const profile = this.profileService.resolve(
        recipeRoleToPlannerRole(spec.role),
        selected.name,
        selected.uri,
        ports,
        `${recipe.song ?? ""} ${recipe.artist ?? ""} ${spec.reason}`
      );

      chain.push({
        role: spec.role,
        name: selected.name,
        uri: selected.uri,
        reason: spec.reason,
        suggestedInstance: `${slug(spec.role)}_${index + 1}`,
        parameterRanges: profile.parameterRanges ?? {}
      });
    }

    return chain;
  }

  private pickForRecipe(
    role: string,
    character: string,
    plugins: PluginCandidate[],
    knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
  ): PluginCandidate | null {
    const preferred = preferredNamesForRoleAndCharacter(role, character);
    const directMatch = findPreferredPlugin(plugins, preferred);
    if (directMatch) return directMatch;

    const scored = plugins
      .map((plugin) => ({
        plugin,
        score: scoreRecipeCandidate(plugin, preferred, knowledgeDb)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.plugin.name.localeCompare(right.plugin.name));
    return scored[0]?.plugin ?? null;
  }
}

function preferredNamesForRecipe(normalized: string): string[] {
  if (matches(normalized, ["drive", "fuzz", "dist", "dirty", "broken", "psychedelic"])) {
    return ["AIDA-X", "Gain 2x2", "Gain"];
  }
  if (matches(normalized, ["modulation", "phaser", "swirl", "movement"])) {
    return ["TAP Chorus/Flanger"];
  }
  if (matches(normalized, ["delay", "echo"])) {
    return ["Bollie Delay"];
  }
  if (matches(normalized, ["reverb", "space", "hall", "plate"])) {
    return ["Dragonfly Hall Reverb", "MVerb"];
  }
  if (matches(normalized, ["output", "level", "trim"])) {
    return ["Gain 2x2", "Gain", "TinyGain Stereo"];
  }
  return ["Gain", "Gain 2x2"];
}

function preferredNamesForRoleAndCharacter(role: string, character: string): string[] {
  const normalizedRole = normalize(role);
  const normalizedCharacter = normalize(character);

  if (matches(normalizedRole, ["drive", "fuzz", "dist", "overdrive", "saturation"])) {
    return ["AIDA-X", "Gain 2x2", "Gain"];
  }
  if (matches(normalizedRole, ["cabinet"])) {
    return ["Vintage Cabinets", "MOD Cabinet", "GxCabinet", "Cabinet Loader"];
  }
  if (matches(normalizedRole, ["modulation", "phaser", "chorus"])) {
    return ["TAP Chorus/Flanger"];
  }
  if (matches(normalizedRole, ["delay", "echo"])) {
    return ["Bollie Delay"];
  }
  if (matches(normalizedRole, ["reverb", "space", "hall", "plate"])) {
    return ["Dragonfly Hall Reverb", "MVerb"];
  }
  if (matches(normalizedRole, ["output", "level", "trim"])) {
    return ["Gain 2x2", "Gain", "TinyGain Stereo"];
  }

  if (matches(normalizedCharacter, ["fuzz", "dist", "dirty", "broken", "psychedelic"])) {
    return ["AIDA-X", "Gain 2x2", "Gain"];
  }
  if (matches(normalizedCharacter, ["cabinet"])) {
    return ["Vintage Cabinets", "MOD Cabinet", "GxCabinet", "Cabinet Loader"];
  }
  if (matches(normalizedCharacter, ["phaser", "chorus", "swirl", "movement"])) {
    return ["TAP Chorus/Flanger"];
  }

  return preferredNamesForRecipe(normalize(`${role} ${character}`));
}

function findPreferredPlugin(plugins: PluginCandidate[], preferred: string[]): PluginCandidate | null {
  for (const target of preferred) {
    const normalizedTarget = normalize(target);
    const exact = plugins.find((plugin) => {
      const normalizedName = normalize(plugin.name);
      const normalizedUri = normalize(plugin.uri ?? "");
      return (
        normalizedName === normalizedTarget ||
        normalizedUri === normalizedTarget ||
        normalizedName.includes(normalizedTarget) ||
        normalizedUri.includes(normalizedTarget)
      );
    });
    if (exact) return exact;
  }
  return null;
}

function selectPreferredPlugin(
  plugins: PluginCandidate[],
  preferred: string[]
): PluginCandidate | null {
  return findPreferredPlugin(plugins, preferred);
}

function scoreRecipeCandidate(
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
      score += 100 - index * 10;
      break;
    }
    if (normalizedName.includes(target) || normalizedUri.includes(target)) {
      score += 60 - index * 5;
    }
  }

  const entry = knowledgeDb?.plugins.find(
    (item) => normalize(item.name) === normalizedName || normalize(item.uri) === normalizedUri
  );
  if (!entry) return score;

  if (entry.goodFor.length > 0) score += 2;
  if (entry.plannerNotes.length > 0) score += 1;
  return score;
}

function recipeRoleToPlannerRole(role: string): string {
  const normalized = normalize(role);
  if (normalized.includes("fuzz")) return "high gain drive";
  if (normalized.includes("drive") || normalized.includes("fuzz") || normalized.includes("dist")) {
    return "high gain drive";
  }
  if (normalized.includes("mod") || normalized.includes("phaser") || normalized.includes("chorus")) {
    return "modulation";
  }
  if (normalized.includes("delay")) return "delay";
  if (normalized.includes("reverb")) return "reverb";
  if (normalized.includes("output")) return "output level";
  return "core tone";
}

function isElephantRecipe(recipe: EffectRecipe): boolean {
  return matches(
    normalize(`${recipe.song ?? ""} ${recipe.artist ?? ""}`),
    ["elephant", "tameimpala"]
  );
}

async function loadDeviceInventoryPlugins(): Promise<PluginCandidate[]> {
  try {
    const absolutePath = resolve(process.cwd(), DEFAULT_DEVICE_INVENTORY_PATH);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as DeviceInventoryFile;
    if (!parsed || !Array.isArray(parsed.plugins)) return [];

    return parsed.plugins
      .map((plugin) => ({ name: plugin.name ?? plugin.uri ?? "", uri: plugin.uri }))
      .filter((plugin) => plugin.name.length > 0);
  } catch {
    return [];
  }
}

function dedupeSnapshots(snapshots: PlannedSnapshot[]): PlannedSnapshot[] {
  const seen = new Set<string>();
  return snapshots.filter((snapshot) => {
    if (seen.has(snapshot.name)) return false;
    seen.add(snapshot.name);
    return true;
  });
}

function recipeSnapshotToPlan(snapshot: EffectRecipe["snapshots"][number]): PlannedSnapshot {
  return {
    name: snapshot.name,
    description: snapshot.description,
    parameterFocus: Object.fromEntries(
      Object.entries(snapshot.effectFocus).map(([key, value]) => [key, stringifyValue(value)])
    )
  };
}

function recipeEffectGoal(effect: EffectRecipe["effects"][number]): string {
  return `${effect.role}: ${effect.character}${effect.intensity ? ` (${effect.intensity})` : ""}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matches(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalize(needle)));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
