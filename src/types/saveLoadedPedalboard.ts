import type { ApiCallRecord, LoadedGraphValidation } from "./importBundle.js";
import type { PedalboardSummary } from "./pedalboard.js";

export interface SaveLoadedPedalboardResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  title: string;
  targetExistsBefore: boolean;
  loadedGraphValidation?: LoadedGraphValidation;
  saved:
    | {
        attempted: true;
        success: true;
        endpoint: "/pedalboard/save";
      }
    | {
        attempted: true;
        success: false;
        error: string;
      }
    | {
        attempted: false;
        success: false;
        error: string;
      };
  appearsAfterSave: boolean;
  matchingPedalboards: PedalboardSummary[];
  apiCalls: ApiCallRecord[];
  banksSaveCalled: false;
  directFileWrites: false;
  notes: string[];
}
