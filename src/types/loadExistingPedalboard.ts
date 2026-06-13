import type { ApiCallRecord } from "./importBundle.js";
import type { PedalboardSummary } from "./pedalboard.js";

export interface LoadExistingPedalboardResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  bundlePath: string;
  targetExistsBefore: boolean;
  matchedPedalboard: PedalboardSummary | null;
  load: {
    attempted: boolean;
    success: boolean;
    endpoint?: "/pedalboard/load_bundle/";
    error?: string;
  };
  apiCalls: ApiCallRecord[];
  banksSaveCalled: false;
  pedalboardSaveCalled: false;
  directFileWrites: false;
  notes: string[];
}
