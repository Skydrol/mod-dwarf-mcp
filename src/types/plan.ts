export interface PedalboardPlanInput {
  style: string;
  instrument: string;
  goals: string[];
  referenceArtists?: string[];
}

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
