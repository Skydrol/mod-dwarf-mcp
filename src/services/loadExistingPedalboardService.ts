import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { LoadExistingPedalboardResult } from "../types/loadExistingPedalboard.js";
import type { PedalboardSummary } from "../types/pedalboard.js";
import type { PedalboardService } from "./pedalboardService.js";

const LOAD_BUNDLE_ENDPOINT = "/pedalboard/load_bundle/";

export class LoadExistingPedalboardService {
  constructor(
    private readonly pedalboardService: PedalboardService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async load(input: {
    bundlePath: string;
    confirm: boolean;
  }): Promise<LoadExistingPedalboardResult> {
    const bundlePath = input.bundlePath.trim();

    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.notAttempted(
        input.confirm,
        bundlePath,
        false,
        null,
        "Write tools are disabled. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true and pass confirm=true.",
        ["Write tools are disabled by default."]
      );
    }
    if (!input.confirm) {
      return this.notAttempted(
        false,
        bundlePath,
        false,
        null,
        "Tool input must include confirm=true.",
        ["Explicit confirmation is required for this load-capable tool."]
      );
    }

    const matchedPedalboard = await this.findByBundlePath(bundlePath);
    if (!matchedPedalboard) {
      return this.notAttempted(
        true,
        bundlePath,
        false,
        null,
        `No saved pedalboard bundle found at '${bundlePath}'.`,
        ["Load aborted before calling /pedalboard/load_bundle/ because the bundle was not listed."]
      );
    }

    let load: LoadExistingPedalboardResult["load"];
    try {
      const response = await this.writeApi.postForm(
        LOAD_BUNDLE_ENDPOINT,
        { bundlepath: bundlePath },
        "load existing saved pedalboard bundle via MOD UI load_bundle"
      );
      load = response.ok
        ? { attempted: true, success: true, endpoint: LOAD_BUNDLE_ENDPOINT }
        : {
            attempted: true,
            success: false,
            error: `HTTP ${response.status} from ${LOAD_BUNDLE_ENDPOINT}`
          };
    } catch (error) {
      load = {
        attempted: true,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    return {
      writeToolsEnabled: true,
      confirmed: true,
      bundlePath,
      targetExistsBefore: true,
      matchedPedalboard,
      load,
      apiCalls: [...this.writeApi.calls],
      banksSaveCalled: false,
      pedalboardSaveCalled: false,
      directFileWrites: false,
      notes: [
        load.success
          ? "Called /pedalboard/load_bundle/ for an existing saved bundle. /pedalboard/save and /banks/save were not called."
          : "Load API call failed. /pedalboard/save and /banks/save were not called."
      ]
    };
  }

  private notAttempted(
    confirmed: boolean,
    bundlePath: string,
    targetExistsBefore: boolean,
    matchedPedalboard: PedalboardSummary | null,
    error: string,
    notes: string[]
  ): LoadExistingPedalboardResult {
    return {
      writeToolsEnabled: this.writeToolsEnabled,
      confirmed,
      bundlePath,
      targetExistsBefore,
      matchedPedalboard,
      load: { attempted: false, success: false, error },
      apiCalls: [],
      banksSaveCalled: false,
      pedalboardSaveCalled: false,
      directFileWrites: false,
      notes
    };
  }

  private async findByBundlePath(bundlePath: string): Promise<PedalboardSummary | null> {
    const source = bundlePath.startsWith("/root/.pedalboards")
      ? "user"
      : bundlePath.startsWith("/usr/share/mod/pedalboards")
        ? "factory"
        : "all";
    const pedalboards = await this.pedalboardService.listPedalboards(source);
    return (
      [...pedalboards.user, ...pedalboards.factory].find(
        (pedalboard) => pedalboard.bundlePath === bundlePath
      ) ?? null
    );
  }
}
