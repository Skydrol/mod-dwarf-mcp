import type { ApiCallRecord } from "./importBundle.js";
import type { PedalboardSummary } from "./pedalboard.js";

export interface SaveLoadedPedalboardResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  title: string;
  targetExistsBefore: boolean;
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
