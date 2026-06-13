import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { PedalboardSummary } from "../types/pedalboard.js";
import type { SaveLoadedPedalboardResult } from "../types/saveLoadedPedalboard.js";
import type { PedalboardService } from "./pedalboardService.js";

const SAVE_ENDPOINT = "/pedalboard/save";

export class SaveLoadedPedalboardService {
  constructor(
    private readonly pedalboardService: PedalboardService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async saveAsNew(input: { title: string; confirm: boolean }): Promise<SaveLoadedPedalboardResult> {
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

    const beforeMatches = await this.findUserMatches(title);
    if (beforeMatches.length > 0) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        title,
        targetExistsBefore: true,
        saved: {
          attempted: false,
          success: false,
          error: `A user pedalboard named '${title}' already exists; refusing to overwrite.`
        },
        appearsAfterSave: true,
        matchingPedalboards: beforeMatches,
        apiCalls: [...this.writeApi.calls],
        banksSaveCalled: false,
        directFileWrites: false,
        notes: ["Save aborted before calling /pedalboard/save because the title already exists."]
      };
    }

    let saved: SaveLoadedPedalboardResult["saved"];
    try {
      const response = await this.writeApi.postForm(
        SAVE_ENDPOINT,
        { title, asNew: 1 },
        "save currently loaded pedalboard as a new user pedalboard"
      );
      saved = response.ok
        ? { attempted: true, success: true, endpoint: SAVE_ENDPOINT }
        : {
            attempted: true,
            success: false,
            error: `HTTP ${response.status} from ${SAVE_ENDPOINT}`
          };
    } catch (error) {
      saved = {
        attempted: true,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    const afterMatches = await this.findUserMatches(title);
    return {
      writeToolsEnabled: true,
      confirmed: true,
      title,
      targetExistsBefore: false,
      saved,
      appearsAfterSave: afterMatches.length > 0,
      matchingPedalboards: afterMatches,
      apiCalls: [...this.writeApi.calls],
      banksSaveCalled: false,
      directFileWrites: false,
      notes: [
        saved.success
          ? "Called /pedalboard/save with asNew=1. /banks/save was not called."
          : "Save API call failed. /banks/save was not called."
      ]
    };
  }

  private notAttempted(
    confirmed: boolean,
    title: string,
    error: string,
    notes: string[]
  ): SaveLoadedPedalboardResult {
    return {
      writeToolsEnabled: this.writeToolsEnabled,
      confirmed,
      title,
      targetExistsBefore: false,
      saved: { attempted: false, success: false, error },
      appearsAfterSave: false,
      matchingPedalboards: [],
      apiCalls: [],
      banksSaveCalled: false,
      directFileWrites: false,
      notes
    };
  }

  private async findUserMatches(title: string): Promise<PedalboardSummary[]> {
    const pedalboards = await this.pedalboardService.listPedalboards("user");
    const normalizedTitle = normalizeTitle(title);
    return pedalboards.user.filter(
      (pedalboard) =>
        normalizeTitle(pedalboard.title ?? pedalboard.bundlePath.split("/").pop() ?? "") ===
        normalizedTitle
    );
  }
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\.pedalboard$/, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}
