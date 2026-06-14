import type { ApiCallRecord, LoadedGraphValidation } from "./importBundle.js";
import type { PedalboardSummary } from "./pedalboard.js";
import type { PedalboardInspection } from "./pedalboard.js";

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
        httpStatus: number;
        body: string;
      }
    | {
        attempted: true;
        success: false;
        error: string;
        httpStatus?: number;
        body?: string;
      }
    | {
        attempted: false;
        success: false;
        error: string;
      };
  appearsAfterSave: boolean;
  matchingPedalboards: PedalboardSummary[];
  savedBundleInspection?: PedalboardInspection | null;
  apiCalls: ApiCallRecord[];
  banksSaveCalled: false;
  directFileWrites: false;
  notes: string[];
}
