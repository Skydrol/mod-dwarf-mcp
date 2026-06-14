import type { WriteHttpClient, WriteHttpResponse } from "../clients/writeHttpClient.js";
import type { ApiCallRecord } from "../types/importBundle.js";
import type {
  ClearCurrentPedalboardInspection,
  ClearCurrentPedalboardResult
} from "../types/clearCurrentPedalboard.js";
import { uiGraphInstancePath } from "./liveGraphRefs.js";

const ACTIVE_GRAPH_ENDPOINT = "/pedalboard/info/";

type ActiveGraphPlugin = {
  instance?: string;
  uri?: string;
};

export class ClearCurrentPedalboardService {
  constructor(
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async clear(input: { confirm: boolean }): Promise<ClearCurrentPedalboardResult> {
    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.notAttempted(
        input.confirm,
        "Write tools are disabled. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true and pass confirm=true.",
        ["Write tools are disabled by default."]
      );
    }
    if (!input.confirm) {
      return this.notAttempted(false, "Tool input must include confirm=true.", [
        "Explicit confirmation is required for this write-capable tool."
      ]);
    }

    const before = await this.inspectActiveGraph("before clear");
    const removeCalls: ApiCallRecord[] = [];
    const removedInstances: string[] = [];
    const removeErrors: string[] = [];

    if (before.ok) {
      for (const plugin of before.plugins) {
        const path = `/effect/remove/${uiGraphInstancePath(plugin.instance)}`;
        const response = await this.writeApi.getBytes(
          path,
          `remove active pedalboard instance ${plugin.instance}`
        );
        removeCalls.push(
          recordCall("GET", path, `remove active pedalboard instance ${plugin.instance}`, response)
        );
        if (response.ok) {
          removedInstances.push(plugin.instance);
        } else {
          removeErrors.push(`Remove failed: ${path} -> HTTP ${response.status}`);
        }
      }
    }

    const after = await this.inspectActiveGraph("after clear");
    const success =
      before.ok &&
      after.ok &&
      after.pluginCount === 0 &&
      removedInstances.length === before.pluginCount &&
      removeErrors.length === 0;

    return {
      writeToolsEnabled: true,
      confirmed: true,
      before,
      after,
      removedInstances,
      removeCalls,
      success,
      notes: [
        "Cleared the currently loaded board using /effect/remove only.",
        "No disconnect, save, load, or snapshot operations were attempted."
      ]
    };
  }

  private async inspectActiveGraph(purpose: string): Promise<ClearCurrentPedalboardInspection> {
    try {
      const response = await this.writeApiOrThrow().getJson<{
        plugins?: ActiveGraphPlugin[];
      }>(ACTIVE_GRAPH_ENDPOINT, `inspect active graph ${purpose}`);
      if (!response.ok || !response.value) {
        if (response.status === 400 && /bad request/i.test(response.text)) {
          return {
            attempted: true,
            ok: true,
            status: response.status,
            pluginCount: 0,
            plugins: [],
            text: response.text
          };
        }
        return {
          attempted: true,
          ok: false,
          status: response.status,
          pluginCount: 0,
          plugins: [],
          text: response.text,
          error: `HTTP ${response.status} from ${ACTIVE_GRAPH_ENDPOINT}`
        };
      }
      const extraction = extractPlugins(response.value.plugins ?? []);
      return {
        attempted: true,
        ok: !extraction.hasMissingInstances,
        status: response.status,
        pluginCount: extraction.plugins.length,
        plugins: extraction.plugins,
        text: response.text,
        error: extraction.hasMissingInstances
          ? "Active graph included a plugin without a removable instance identifier."
          : undefined
      };
    } catch (error) {
      return {
        attempted: true,
        ok: false,
        status: null,
        pluginCount: 0,
        plugins: [],
        text: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private notAttempted(
    confirmed: boolean,
    error: string,
    notes: string[]
  ): ClearCurrentPedalboardResult {
    return {
      writeToolsEnabled: this.writeToolsEnabled,
      confirmed,
      before: {
        attempted: false,
        ok: false,
        status: null,
        pluginCount: 0,
        plugins: [],
        text: "",
        error
      },
      after: {
        attempted: false,
        ok: false,
        status: null,
        pluginCount: 0,
        plugins: [],
        text: "",
        error
      },
      removedInstances: [],
      removeCalls: [],
      success: false,
      notes
    };
  }

  private writeApiOrThrow(): WriteHttpClient {
    if (!this.writeApi) throw new Error("Write API is disabled");
    return this.writeApi;
  }
}

function extractPlugins(plugins: ActiveGraphPlugin[]): {
  plugins: Array<{ instance: string; uri: string }>;
  hasMissingInstances: boolean;
} {
  let hasMissingInstances = false;
  const normalized = plugins
    .map((plugin) => {
      const instance = normalizeInstance(plugin.instance ?? "");
      if (!instance) {
        hasMissingInstances = true;
      }
      return {
        instance,
        uri: plugin.uri ?? ""
      };
    })
    .filter((plugin) => Boolean(plugin.instance.trim()));
  return { plugins: normalized, hasMissingInstances };
}

function normalizeInstance(value: string): string {
  return value
    .trim()
    .replace(/^(?:\/graph\/|graph\/)/, "")
    .replace(/^\//, "");
}

function recordCall(
  method: "GET" | "POST",
  path: string,
  purpose: string,
  response: WriteHttpResponse
): ApiCallRecord {
  return {
    method,
    path,
    purpose,
    status: response.ok ? "success" : "failed",
    httpStatus: response.status
  };
}
