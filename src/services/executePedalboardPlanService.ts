import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { LiveGraphAuthoringPlanService } from "./liveGraphAuthoringPlan.js";
import type { LoadExistingPedalboardService } from "./loadExistingPedalboardService.js";
import type { SaveLoadedPedalboardService } from "./saveLoadedPedalboardService.js";
import type { PedalboardPlan } from "../types/plan.js";
import type { LiveGraphApiCall } from "../types/liveGraphAuthoringPlan.js";

export interface ExecutePedalboardPlanResult {
  confirmed: boolean;
  operationMode: PedalboardPlan["operationMode"];
  title: string;
  applied: boolean;
  saved: boolean;
  loaded: boolean;
  apiCalls: Array<{
    method: "GET" | "POST";
    path: string;
    purpose: string;
    status: "success" | "failed" | "skipped";
    httpStatus?: number;
    error?: string;
  }>;
  notes: string[];
}

export class ExecutePedalboardPlanService {
  constructor(
    private readonly liveGraphAuthoringPlanService: LiveGraphAuthoringPlanService,
    private readonly saveLoadedPedalboardService: SaveLoadedPedalboardService,
    private readonly loadExistingPedalboardService: LoadExistingPedalboardService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async execute(input: {
    plan: PedalboardPlan;
    confirm: boolean;
    title?: string;
  }): Promise<ExecutePedalboardPlanResult> {
    const title = (input.title ?? this.defaultTitle(input.plan)).trim();
    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.notAttempted(input.plan.operationMode, title, "Write tools are disabled.");
    }
    if (!input.confirm) {
      return this.notAttempted(input.plan.operationMode, title, "Tool input must include confirm=true.");
    }

    const plan = await this.liveGraphAuthoringPlanService.buildPlan(input.plan);
    const apiCalls: ExecutePedalboardPlanResult["apiCalls"] = [];
    const notes: string[] = [...plan.notes];
    let applied = false;

    if (input.plan.operationMode === "new_board" || input.plan.operationMode === "replace_current_board") {
      const resetResponse = await this.writeApi.getBytes(
        "/reset",
        `prepare ${input.plan.operationMode.replace(/_/g, " ")} before execute pedalboard plan`
      );
      apiCalls.push(recordCall("GET", "/reset", "prepare board before execute pedalboard plan", resetResponse));
      if (!resetResponse.ok) {
        return {
          confirmed: true,
          operationMode: input.plan.operationMode,
          title,
          applied: false,
          saved: false,
          loaded: false,
          apiCalls,
          notes: [...notes, `Reset failed with HTTP ${resetResponse.status}.`]
        };
      }
    }

    for (const call of plan.apiCalls) {
      const response = await executeApiCall(this.writeApi, call);
      apiCalls.push(recordCall(call.method, call.path, call.purpose, response));
      if (!response.ok) {
        return {
          confirmed: true,
          operationMode: input.plan.operationMode,
          title,
          applied: false,
          saved: false,
          loaded: false,
          apiCalls,
          notes: [...notes, `Execution stopped on HTTP ${response.status} for ${call.path}.`]
        };
      }
    }

    applied = true;

    const saveResult = await this.saveLoadedPedalboardService.saveAsNew({
      title,
      confirm: true,
      expectedPluginUris: input.plan.signalChain.map((plugin) => plugin.uri).filter(Boolean) as string[]
    });
    const saved = Boolean(saveResult.saved.success);
    const savedBundlePath = saveResult.matchingPedalboards[0]?.bundlePath ?? null;

    let loaded = false;
    if (saved && savedBundlePath) {
      const loadResult = await this.loadExistingPedalboardService.load({
        bundlePath: savedBundlePath,
        confirm: true
      });
      loaded = Boolean(loadResult.load.success);
      apiCalls.push(...loadResult.apiCalls);
      notes.push(...loadResult.notes);
    } else {
      notes.push("Saved pedalboard was not reloaded because no matching bundle path was found.");
    }

    return {
      confirmed: true,
      operationMode: input.plan.operationMode,
      title,
      applied,
      saved,
      loaded,
      apiCalls: [...apiCalls, ...saveResult.apiCalls],
      notes: [...notes, ...saveResult.notes]
    };
  }

  private notAttempted(
    operationMode: PedalboardPlan["operationMode"],
    title: string,
    error: string
  ): ExecutePedalboardPlanResult {
    return {
      confirmed: false,
      operationMode,
      title,
      applied: false,
      saved: false,
      loaded: false,
      apiCalls: [],
      notes: [error]
    };
  }

  private defaultTitle(plan: PedalboardPlan): string {
    return `${plan.request.instrument} ${plan.request.style}`.trim() || "MOD Dwarf Pedalboard";
  }
}

async function executeApiCall(writeApi: WriteHttpClient, call: LiveGraphApiCall) {
  if (call.method === "GET") {
    return writeApi.getBytes(call.path, call.purpose);
  }
  if (call.body.kind === "form") {
    return writeApi.postForm(call.path, call.body.fields, call.purpose);
  }
  if (call.body.kind === "json") {
    return writeApi.postJson(call.path, call.body.value, call.purpose);
  }
  return writeApi.postForm(call.path, {}, call.purpose);
}

function recordCall(
  method: "GET" | "POST",
  path: string,
  purpose: string,
  response: { ok: boolean; status: number; text: string }
) {
  return {
    method,
    path,
    purpose,
    status: response.ok ? ("success" as const) : ("failed" as const),
    httpStatus: response.status,
    error: response.ok ? undefined : response.text.slice(0, 500)
  };
}
