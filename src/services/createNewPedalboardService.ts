import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { CreateNewPedalboardResult } from "../types/createNewPedalboard.js";

const RESET_ENDPOINT = "/reset";
const SAVE_ENDPOINT = "/pedalboard/save";
const LOAD_BUNDLE_ENDPOINT = "/pedalboard/load_bundle/";

export class CreateNewPedalboardService {
  constructor(
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async create(input: { title: string; confirm: boolean }): Promise<CreateNewPedalboardResult> {
    const title = input.title.trim();

    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.notAttempted(
        input.confirm,
        title,
        "Write tools are disabled. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true and pass confirm=true.",
        ["Write tools are disabled by default."]
      );
    }

    if (!input.confirm) {
      return this.notAttempted(false, title, "Tool input must include confirm=true.", [
        "Explicit confirmation is required for this write-capable tool."
      ]);
    }

    const reset = await this.callReset();
    if (!reset.success) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        title,
        operationMode: "new_board",
        reset,
        saved: {
          attempted: false,
          success: false,
          endpoint: SAVE_ENDPOINT,
          error: "Pedalboard reset failed before save could be attempted."
        },
        apiCalls: [...this.writeApi.calls],
        directFileWrites: false,
        notes: ["Creation aborted before calling /pedalboard/save because /reset failed."]
      };
    }

    const save = await this.callSave(title);
    if (!save.success) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        title,
        operationMode: "new_board",
        reset,
        saved: save,
        apiCalls: [...this.writeApi.calls],
        directFileWrites: false,
        notes: ["Creation aborted because /pedalboard/save failed after reset."]
      };
    }

    const load = await this.callLoadBundle(save.bundlePath);

    return {
      writeToolsEnabled: true,
      confirmed: true,
      title,
      operationMode: "new_board",
      reset,
      saved: save,
      apiCalls: [...this.writeApi.calls],
      directFileWrites: false,
      notes: [
        "Called /reset first, then /pedalboard/save with asNew=1.",
        load.success
          ? "Loaded the saved bundle once more so connected UIs can refresh the title."
          : `Saved the board, but the title refresh load failed: ${load.error}`
      ]
    };
  }

  private async callReset(): Promise<CreateNewPedalboardResult["reset"]> {
    try {
      const response = await this.writeApiOrThrow().getBytes(
        RESET_ENDPOINT,
        "reset pedalboard before creating a new empty pedalboard"
      );
      if (response.ok) {
        return {
          attempted: true,
          success: true,
          endpoint: RESET_ENDPOINT,
          httpStatus: response.status,
          body: response.text
        };
      }
      return {
        attempted: true,
        success: false,
        endpoint: RESET_ENDPOINT,
        httpStatus: response.status,
        body: response.text,
        error: `HTTP ${response.status} from ${RESET_ENDPOINT}`
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        endpoint: RESET_ENDPOINT,
        httpStatus: 0,
        body: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async callSave(title: string): Promise<SaveOutcome> {
    try {
      const response = await this.writeApiOrThrow().postForm(
        SAVE_ENDPOINT,
        { title, asNew: 1 },
        "save a reset pedalboard as a new user pedalboard"
      );
      if (response.ok) {
        const bundlePath = parseBundlePath(response.text);
        if (!bundlePath) {
          return {
          attempted: true,
          success: false,
          endpoint: SAVE_ENDPOINT,
          httpStatus: response.status,
          body: response.text,
          error: `Could not parse bundle path from ${SAVE_ENDPOINT}`
          };
        }
        return {
          attempted: true,
          success: true,
          endpoint: SAVE_ENDPOINT,
          httpStatus: response.status,
          body: response.text,
          bundlePath
        };
      }
      return {
        attempted: true,
        success: false,
        endpoint: SAVE_ENDPOINT,
        httpStatus: response.status,
        body: response.text,
        error: `HTTP ${response.status} from ${SAVE_ENDPOINT}`
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        endpoint: SAVE_ENDPOINT,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async callLoadBundle(bundlePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.writeApiOrThrow().postForm(
        LOAD_BUNDLE_ENDPOINT,
        { bundlepath: bundlePath },
        "reload the saved pedalboard so connected UIs refresh the title"
      );
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${response.status} from ${LOAD_BUNDLE_ENDPOINT}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private notAttempted(
    confirmed: boolean,
    title: string,
    error: string,
    notes: string[]
  ): CreateNewPedalboardResult {
    return {
      writeToolsEnabled: this.writeToolsEnabled,
      confirmed,
      title,
      operationMode: "new_board",
      reset: {
        attempted: false,
        success: false,
        endpoint: RESET_ENDPOINT,
        error
      },
      saved: {
        attempted: false,
        success: false,
        endpoint: SAVE_ENDPOINT,
        error
      },
      apiCalls: [],
      directFileWrites: false,
      notes
    };
  }

  private writeApiOrThrow(): WriteHttpClient {
    if (!this.writeApi) throw new Error("Write API is disabled");
    return this.writeApi;
  }
}

function parseBundlePath(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { bundlepath?: unknown };
    return typeof parsed.bundlepath === "string" ? parsed.bundlepath : undefined;
  } catch {
    return undefined;
  }
}

type SaveOutcome =
  | {
      attempted: true;
      success: true;
      endpoint: "/pedalboard/save";
      httpStatus: number;
      body: string;
      bundlePath: string;
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
