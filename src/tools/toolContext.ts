import type { BankService } from "../services/bankService.js";
import type { DeviceService } from "../services/deviceService.js";
import type { DryBundleService } from "../services/dryBundleService.js";
import type { LiveGraphAuthoringPlanService } from "../services/liveGraphAuthoringPlan.js";
import type { LiveGraphBuilderService } from "../services/liveGraphBuilderService.js";
import type { LiveGraphConnectionExperimentService } from "../services/liveGraphConnectionExperimentService.js";
import type { LiveGraphExperimentService } from "../services/liveGraphExperimentService.js";
import type { ClearCurrentPedalboardService } from "../services/clearCurrentPedalboardService.js";
import type { CreateNewPedalboardService } from "../services/createNewPedalboardService.js";
import type { DeviceInventoryService } from "../services/deviceInventoryService.js";
import type { ImportBundleService } from "../services/importBundleService.js";
import type { LoadExistingPedalboardService } from "../services/loadExistingPedalboardService.js";
import type { PedalboardService } from "../services/pedalboardService.js";
import type { PluginService } from "../services/pluginService.js";
import type { SaveLoadedPedalboardService } from "../services/saveLoadedPedalboardService.js";
import type { PedalboardPlannerService } from "../services/pedalboardPlannerService.js";
import type { SnapshotService } from "../services/snapshotService.js";
import type { ExecutePedalboardPlanService } from "../services/executePedalboardPlanService.js";
import type { EffectRecipeToPedalboardPlanService } from "../services/effectRecipeToPedalboardPlanService.js";

export interface ToolContext {
  deviceService: DeviceService;
  pluginService: PluginService;
  pedalboardService: PedalboardService;
  bankService: BankService;
  snapshotService: SnapshotService;
  pedalboardPlannerService: PedalboardPlannerService;
  liveGraphAuthoringPlanService: LiveGraphAuthoringPlanService;
  liveGraphBuilderService: LiveGraphBuilderService;
  liveGraphExperimentService: LiveGraphExperimentService;
  liveGraphConnectionExperimentService: LiveGraphConnectionExperimentService;
  dryBundleService: DryBundleService;
  clearCurrentPedalboardService: ClearCurrentPedalboardService;
  createNewPedalboardService: CreateNewPedalboardService;
  deviceInventoryService: DeviceInventoryService;
  importBundleService: ImportBundleService;
  saveLoadedPedalboardService: SaveLoadedPedalboardService;
  loadExistingPedalboardService: LoadExistingPedalboardService;
  executePedalboardPlanService: ExecutePedalboardPlanService;
  effectRecipeToPedalboardPlanService: EffectRecipeToPedalboardPlanService;
}

export function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
