import type { ApiCallRecord } from "./importBundle.js";

export interface CreateNewPedalboardResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  title: string;
  reset:
    | {
        attempted: true;
        success: true;
        endpoint: "/reset";
        httpStatus: number;
        body: string;
      }
    | {
        attempted: true;
        success: false;
        endpoint: "/reset";
        httpStatus: number;
        body: string;
        error: string;
      }
    | {
        attempted: false;
        success: false;
        endpoint: "/reset";
        error: string;
      };
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
        endpoint: "/pedalboard/save";
        error: string;
        httpStatus?: number;
        body?: string;
      }
      | {
        attempted: false;
        success: false;
        endpoint: "/pedalboard/save";
        error: string;
      };
  apiCalls: ApiCallRecord[];
  directFileWrites: false;
  notes: string[];
}
