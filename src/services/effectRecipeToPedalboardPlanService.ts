import type { EffectRecipe, PedalboardPlan, PlannedSnapshot } from "../types/plan.js";
import type { PedalboardPlannerService } from "./pedalboardPlannerService.js";

export class EffectRecipeToPedalboardPlanService {
  constructor(private readonly plannerService: PedalboardPlannerService) {}

  async convert(recipe: EffectRecipe): Promise<PedalboardPlan> {
    const plan = await this.plannerService.planFromPrompt({
      style: recipe.song ?? recipe.artist ?? "recipe",
      instrument: recipe.instrument,
      goals: recipe.effects.map((effect) => `${effect.role}: ${effect.character}`),
      referenceArtists: recipe.artist ? [recipe.artist] : []
    });

    const snapshots = dedupeSnapshots(
      recipe.snapshots.length > 0 ? recipe.snapshots.map(recipeSnapshotToPlan) : plan.snapshots
    );
    const sectionSnapshotNames = new Set(recipe.sections.map((section) => section.snapshot));
    const missingSnapshots = recipe.sections
      .map((section) => section.snapshot)
      .filter((snapshotName) => !snapshots.some((snapshot) => snapshot.name === snapshotName));

    return {
      ...plan,
      operationMode: recipe.operationMode,
      request: {
        style: recipe.song ?? recipe.artist ?? "recipe",
        instrument: recipe.instrument,
        goals: recipe.effects.map((effect) => recipeEffectGoal(effect)),
        referenceArtists: recipe.artist ? [recipe.artist] : []
      },
      snapshots,
      notes: [
        ...plan.notes,
        ...recipe.sections.map(
          (section) => `Section '${section.name}' reuses snapshot '${section.snapshot}'.`
        ),
        ...(sectionSnapshotNames.size > 0
          ? [`Recipe snapshot reuse count: ${sectionSnapshotNames.size}.`]
          : []),
        ...(missingSnapshots.length > 0
          ? [`Recipe referenced missing snapshots: ${dedupe(missingSnapshots).join(", ")}.`]
          : [])
      ]
    };
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

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
