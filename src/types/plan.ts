export interface PedalboardPlanInput {
  style: string;
  instrument: string;
  goals: string[];
  referenceArtists?: string[];
}

export type EffectRecipeIntensity = "subtle" | "medium" | "strong";

export interface EffectRecipeEffect {
  role: string;
  character: string;
  intensity?: EffectRecipeIntensity;
}

export interface EffectRecipeSnapshot {
  name: string;
  description: string;
  effectFocus: Record<string, unknown>;
}

export interface EffectRecipeSection {
  name: string;
  snapshot: string;
}

export interface EffectRecipe {
  song?: string;
  artist?: string;
  instrument: string;
  operationMode: PedalboardOperationMode;
  effects: EffectRecipeEffect[];
  snapshots: EffectRecipeSnapshot[];
  sections: EffectRecipeSection[];
}

export type PedalboardOperationMode =
  | "new_board"
  | "replace_current_board"
  | "modify_current_board"
  | "parameter_only";

export interface PlannedPlugin {
  role: string;
  name: string;
  uri?: string;
  reason: string;
  suggestedInstance: string;
  parameterRanges: Record<string, { min: number; max: number; unit?: string }>;
}

export interface PlannedSnapshot {
  name: string;
  description: string;
  parameterFocus: Record<string, string>;
}

export interface PedalboardPlan {
  dryRun: true;
  operationMode: PedalboardOperationMode;
  safety: {
    writesFiles: false;
    modifiesDevice: false;
    callsPostEndpoints: false;
  };
  request: PedalboardPlanInput;
  template: {
    title: string | null;
    bundlePath: string;
    source: "user" | "factory";
    reason: string;
  } | null;
  availablePluginCount: number;
  signalChain: PlannedPlugin[];
  snapshots: PlannedSnapshot[];
  notes: string[];
  unsupportedIdeas: string[];
}
