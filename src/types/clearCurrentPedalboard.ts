import type { ApiCallRecord } from "./importBundle.js";

export interface ClearCurrentPedalboardInspection {
  attempted: boolean;
  ok: boolean;
  status: number | null;
  pluginCount: number;
  plugins: Array<{ instance: string; uri: string }>;
  text: string;
  error?: string;
}

export interface ClearCurrentPedalboardResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  before: ClearCurrentPedalboardInspection;
  after: ClearCurrentPedalboardInspection;
  removedInstances: string[];
  removeCalls: ApiCallRecord[];
  success: boolean;
  notes: string[];
}
