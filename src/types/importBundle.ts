export interface ApiCallRecord {
  method: "GET" | "POST";
  path: string;
  purpose: string;
  status: "success" | "failed" | "skipped";
  httpStatus?: number;
  error?: string;
}

export interface ImportDryBundleResult {
  writeToolsEnabled: boolean;
  confirmed: boolean;
  dryRunSourceVerified: boolean;
  targetName: string;
  targetExists: boolean;
  backup:
    | {
        required: true;
        created: true;
        path: string;
      }
    | {
        required: true;
        created: false;
        error: string;
      }
    | {
        required: false;
        created: false;
      };
  import:
    | {
        attempted: true;
        success: true;
        endpoint: string;
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
  localArchivePath: string | null;
  apiCalls: ApiCallRecord[];
  directFileWrites: false;
  notes: string[];
}
