import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EffectRecipe, PedalboardPlan, PlannedPlugin, PlannedSnapshot } from "../types/plan.js";
import type { PluginService } from "./pluginService.js";
import type { PluginKnowledgeDbService } from "./pluginKnowledgeDbService.js";
import type { RoleParameterProfileService } from "./roleParameterProfileService.js";
import type { PedalboardSafetyService } from "./pedalboardSafetyService.js";
import { pluginCatalog } from "../data/pluginCatalog.js";

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
    const chain: PlannedPlugin[] = [];

    for (let index = 0; index < recipe.effects.length; index += 1) {
      const effect = recipe.effects[index];
      const selected = this.pickForEffect(effect, plugins, knowledgeDb);
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
        parameterRanges: mergeExplicitParameters(profile.parameterRanges ?? {}, effect.parameters)
      });
    }

    return chain;
  }

  private pickForEffect(
    effect: EffectRecipe["effects"][number],
    plugins: PluginCandidate[],
    knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>
  ): PluginCandidate | null {
    if (effect.preferredPluginUri) {
      const byUri = plugins.find((p) => p.uri === effect.preferredPluginUri);
      if (byUri) return byUri;
    }
    const preferred = effect.preferredPluginName
      ? [effect.preferredPluginName, ...preferredNamesForRoleAndCharacter(effect.role, effect.character)]
      : preferredNamesForRoleAndCharacter(effect.role, effect.character);
    const directMatch = findPreferredPlugin(plugins, preferred);
    if (directMatch) return directMatch;
    const scored = plugins
      .map((plugin) => ({
        plugin,
        score: scoreRecipeCandidate(plugin, preferred, knowledgeDb, effect.role)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.plugin.name.localeCompare(right.plugin.name));
    return scored[0]?.plugin ?? null;
  }
}

function preferredNamesForRecipe(normalized: string): string[] {
  if (matches(normalized, ["dist"])) {
    return ["DS1", "MetalTone", "CollisionDrive", "GxSD1", "Open Big Muff", "ChowCentaur", "GxTubeScreamer"];
  }
  if (matches(normalized, ["fuzz"])) {
    return ["Open Big Muff", "DS1", "MetalTone"];
  }
  if (matches(normalized, ["boost"])) {
    return ["GxBooster", "ChowCentaur", "GxTubeScreamer", "TAP Sigmoid Booster"];
  }
  if (matches(normalized, ["drive", "overdrive", "saturation", "dirty", "broken", "psychedelic"])) {
    return ["GxTubeScreamer", "CollisionDrive", "GxSD1", "ChowCentaur", "DS1", "TAP Tubewarmth"];
  }
  if (matches(normalized, ["amp", "modeler", "ampsim", "amplifier", "cabinet", "neural"])) {
    return ["AIDA-X", "Vintage Cabinets"];
  }
  if (matches(normalized, ["modulation", "phaser", "swirl", "movement", "chorus", "flanger"])) {
    return ["TAP Chorus/Flanger", "Modulay"];
  }
  if (matches(normalized, ["delay", "echo"])) {
    return ["Bollie Delay", "MDA DubDelay", "TAP Stereo Echo"];
  }
  if (matches(normalized, ["reverb", "space", "hall", "plate", "room"])) {
    return ["Dragonfly Hall Reverb", "MVerb", "Dragonfly Room Reverb", "Dragonfly Plate Reverb", "TAL-Reverb-II", "Shiroverb"];
  }
  if (matches(normalized, ["output", "level", "trim"])) {
    return ["Gain 2x2", "Gain", "TinyGain Stereo"];
  }
  return ["Gain", "Gain 2x2"];
}

function preferredNamesForRoleAndCharacter(role: string, character: string): string[] {
  const normalizedRole = normalize(role);
  const normalizedCharacter = normalize(character);

  if (matches(normalizedRole, ["dist"])) {
    return ["DS1", "MetalTone", "CollisionDrive", "GxSD1", "Open Big Muff", "ChowCentaur", "GxTubeScreamer"];
  }
  if (matches(normalizedRole, ["fuzz"])) {
    return ["Open Big Muff", "DS1", "MetalTone", "CollisionDrive"];
  }
  if (matches(normalizedRole, ["boost"])) {
    return ["GxBooster", "ChowCentaur", "GxTubeScreamer", "TAP Sigmoid Booster"];
  }
  if (matches(normalizedRole, ["overdrive", "drive", "saturation"])) {
    return ["GxTubeScreamer", "CollisionDrive", "GxSD1", "ChowCentaur", "DS1", "TAP Tubewarmth"];
  }
  if (matches(normalizedRole, ["amp_modeler", "amp_and_cab_modeler", "ampsim", "amp", "neural"])) {
    return ["AIDA-X"];
  }
  if (matches(normalizedRole, ["cabinet"])) {
    return ["Vintage Cabinets", "AIDA-X"];
  }
  if (matches(normalizedRole, ["modulation", "phaser", "chorus", "flanger"])) {
    return ["TAP Chorus/Flanger", "Modulay"];
  }
  if (matches(normalizedRole, ["delay", "echo"])) {
    return ["Bollie Delay", "MDA DubDelay", "TAP Stereo Echo"];
  }
  if (matches(normalizedRole, ["reverb", "space", "hall", "plate", "room"])) {
    return ["Dragonfly Hall Reverb", "MVerb", "Dragonfly Room Reverb", "Dragonfly Plate Reverb", "TAL-Reverb-II", "Shiroverb"];
  }
  if (matches(normalizedRole, ["output", "level", "trim", "gain"])) {
    return ["Gain 2x2", "Gain", "TinyGain Stereo", "TinyGain Mono"];
  }

  if (matches(normalizedCharacter, ["dist", "metal", "heavy", "hard clip"])) {
    return ["DS1", "MetalTone", "CollisionDrive", "GxSD1", "ChowCentaur", "GxTubeScreamer"];
  }
  if (matches(normalizedCharacter, ["fuzz", "grungy", "woolly", "broken", "psychedelic"])) {
    return ["Open Big Muff", "DS1", "MetalTone"];
  }
  if (matches(normalizedCharacter, ["amp", "neural", "modeler"])) {
    return ["AIDA-X"];
  }
  if (matches(normalizedCharacter, ["cabinet"])) {
    return ["Vintage Cabinets", "AIDA-X"];
  }
  if (matches(normalizedCharacter, ["phaser", "chorus", "swirl", "movement", "flanger"])) {
    return ["TAP Chorus/Flanger", "Modulay"];
  }
  if (matches(normalizedCharacter, ["overdrive", "drive", "saturation", "dirty", "warm"])) {
    return ["GxTubeScreamer", "CollisionDrive", "GxSD1", "ChowCentaur", "DS1", "TAP Tubewarmth"];
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

function catalogMetadataScore(plugin: PluginCandidate, requestedRole: string): number {
  const entry = pluginCatalog.find((item) => item.uri === plugin.uri);
  if (!entry) return 0;
  const normalized = normalize(requestedRole);
  let score = 0;

  if (entry.category) {
    const cat = entry.category;
    const roleMatchesCategory =
      (matches(normalized, ["dist"]) && (cat === "distortion" || cat === "fuzz")) ||
      (matches(normalized, ["fuzz"]) && cat === "fuzz") ||
      (matches(normalized, ["boost"]) && cat === "boost") ||
      (matches(normalized, ["overdrive", "drive", "saturation"]) && (cat === "overdrive" || cat === "distortion")) ||
      (matches(normalized, ["amp", "neural", "modeler", "ampsim"]) && (cat === "amp_modeler" || cat === "amp_and_cab_modeler")) ||
      (matches(normalized, ["cabinet"]) && (cat === "cabinet" || cat === "amp_and_cab_modeler")) ||
      (matches(normalized, ["modulation", "chorus", "phaser", "flanger"]) && cat === "modulation") ||
      (matches(normalized, ["delay", "echo"]) && cat === "delay") ||
      (matches(normalized, ["reverb", "space", "hall", "plate", "room"]) && cat === "reverb") ||
      (matches(normalized, ["gain", "level", "trim", "output"]) && (cat === "gain" || cat === "utility"));
    if (roleMatchesCategory) score += 40;

    const roleConflictsCategory =
      (matches(normalized, ["dist", "fuzz", "overdrive", "drive", "saturation", "boost"]) &&
        (cat === "amp_and_cab_modeler" || cat === "amp_modeler")) ||
      (matches(normalized, ["reverb"]) && cat === "delay") ||
      (matches(normalized, ["delay"]) && cat === "reverb");
    if (roleConflictsCategory) score -= 50;
  }

  if (entry.requiresExternalModel === true) {
    const isAmpRole = matches(normalized, ["amp", "neural", "modeler", "ampsim", "cabinet"]);
    if (!isAmpRole) score -= 30;
  }

  if (entry.avoidForRoles?.some((avoided) => normalize(avoided) === normalized)) {
    score -= 60;
  }

  return score;
}

function scoreRecipeCandidate(
  plugin: PluginCandidate,
  preferred: string[],
  knowledgeDb: Awaited<ReturnType<PluginKnowledgeDbService["load"]>>,
  requestedRole = ""
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

  score += catalogMetadataScore(plugin, requestedRole);

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
      Object.entries(snapshot.effectFocus ?? {}).map(([key, value]) => [key, stringifyValue(value)])
    ),
    ...(snapshot.parameterValues ? { parameterValues: snapshot.parameterValues } : {})
  };
}

function mergeExplicitParameters(
  base: Record<string, { min: number; max: number; unit?: string }>,
  explicit?: Record<string, number>
): Record<string, { min: number; max: number; unit?: string }> {
  if (!explicit) return base;
  const result = { ...base };
  for (const [symbol, value] of Object.entries(explicit)) {
    result[symbol] = { min: value, max: value };
  }
  return result;
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
