import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { LoadedGraphValidation } from "../types/importBundle.js";
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

  async saveAsNew(input: {
    title: string;
    confirm: boolean;
    expectedPluginUris?: string[];
    loadedBundlePath?: string;
  }): Promise<SaveLoadedPedalboardResult> {
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

    const loadedGraphValidation = await this.validateExpectedLoadedGraph(input);
    if (loadedGraphValidation && !loadedGraphValidation.success) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        title,
        targetExistsBefore: false,
        loadedGraphValidation,
        saved: {
          attempted: false,
          success: false,
          error: "Loaded graph plugin URIs do not match the intended dry bundle; refusing to save."
        },
        appearsAfterSave: false,
        matchingPedalboards: [],
        apiCalls: [...this.writeApi.calls],
        banksSaveCalled: false,
        directFileWrites: false,
        notes: [
          "Save aborted before calling /pedalboard/save because loaded graph validation failed."
        ]
      };
    }

    const beforeMatches = await this.findUserMatches(title);
    if (beforeMatches.length > 0) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        title,
        targetExistsBefore: true,
        loadedGraphValidation,
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
      loadedGraphValidation,
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

  private async validateExpectedLoadedGraph(input: {
    expectedPluginUris?: string[];
    loadedBundlePath?: string;
  }): Promise<LoadedGraphValidation | undefined> {
    if (!input.expectedPluginUris && !input.loadedBundlePath) return undefined;
    const expectedPluginUris = input.expectedPluginUris ?? [];
    const bundlePath = input.loadedBundlePath ?? null;
    if (!bundlePath) {
      return {
        attempted: false,
        success: false,
        bundlePath,
        pluginCount: 0,
        expectedPluginUris,
        actualPluginUris: [],
        missingPluginUris: expectedPluginUris,
        error: "loadedBundlePath is required when expectedPluginUris are provided"
      };
    }

    try {
      const response = await this.writeApiOrThrow().getJson<{ plugins?: Array<{ uri?: string }> }>(
        `/pedalboard/info/?bundlepath=${encodeURIComponent(bundlePath)}`,
        "validate currently loaded graph before save"
      );
      if (!response.ok || !response.value) {
        return {
          attempted: true,
          success: false,
          bundlePath,
          pluginCount: 0,
          expectedPluginUris,
          actualPluginUris: [],
          missingPluginUris: expectedPluginUris,
          error: `HTTP ${response.status} from /pedalboard/info/`
        };
      }

      const actualPluginUris = Array.isArray(response.value.plugins)
        ? response.value.plugins
            .map((plugin) => plugin.uri)
            .filter((uri): uri is string => Boolean(uri))
        : [];
      const missingPluginUris = expectedPluginUris.filter((uri) => !actualPluginUris.includes(uri));
      return {
        attempted: true,
        success: actualPluginUris.length > 0 && missingPluginUris.length === 0,
        bundlePath,
        pluginCount: actualPluginUris.length,
        expectedPluginUris,
        actualPluginUris,
        missingPluginUris,
        error:
          actualPluginUris.length === 0
            ? "MOD UI reports zero plugins for the loaded bundle"
            : missingPluginUris.length > 0
              ? "Loaded graph is missing expected plugin URIs"
              : undefined
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        bundlePath,
        pluginCount: 0,
        expectedPluginUris,
        actualPluginUris: [],
        missingPluginUris: expectedPluginUris,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private writeApiOrThrow(): WriteHttpClient {
    if (!this.writeApi) throw new Error("Write API is disabled");
    return this.writeApi;
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
