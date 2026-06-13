import type { BankService } from "../services/bankService.js";
import type { DeviceService } from "../services/deviceService.js";
import type { DryBundleService } from "../services/dryBundleService.js";
import type { LiveGraphAuthoringPlanService } from "../services/liveGraphAuthoringPlan.js";
import type { ImportBundleService } from "../services/importBundleService.js";
import type { LoadExistingPedalboardService } from "../services/loadExistingPedalboardService.js";
import type { PedalboardService } from "../services/pedalboardService.js";
import type { PluginService } from "../services/pluginService.js";
import type { SaveLoadedPedalboardService } from "../services/saveLoadedPedalboardService.js";
import type { PedalboardPlannerService } from "../services/pedalboardPlannerService.js";
import type { SnapshotService } from "../services/snapshotService.js";

export interface ToolContext {
  deviceService: DeviceService;
  pluginService: PluginService;
  pedalboardService: PedalboardService;
  bankService: BankService;
  snapshotService: SnapshotService;
  pedalboardPlannerService: PedalboardPlannerService;
  liveGraphAuthoringPlanService: LiveGraphAuthoringPlanService;
  dryBundleService: DryBundleService;
  importBundleService: ImportBundleService;
  saveLoadedPedalboardService: SaveLoadedPedalboardService;
  loadExistingPedalboardService: LoadExistingPedalboardService;
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
