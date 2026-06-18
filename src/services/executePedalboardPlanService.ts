import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { SshClient } from "../clients/sshClient.js";
import type { ClearCurrentPedalboardService } from "./clearCurrentPedalboardService.js";
import type { DryBundleService } from "./dryBundleService.js";
import type { LiveGraphAuthoringPlanService } from "./liveGraphAuthoringPlan.js";
import type { PedalboardService } from "./pedalboardService.js";
import type { SaveLoadedPedalboardService } from "./saveLoadedPedalboardService.js";
import type { PedalboardPlan } from "../types/plan.js";
import type { LiveGraphApiCall } from "../types/liveGraphAuthoringPlan.js";
import { uiGraphInstancePath, uiGraphRef } from "./liveGraphRefs.js";

export interface ExecutePedalboardPlanResult {
  confirmed: boolean;
  operationMode: PedalboardPlan["operationMode"];
  title: string;
  imported: boolean;
  saved: boolean;
  loaded: boolean;
  reportPath: string | null;
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
    private readonly dryBundleService: DryBundleService,
    private readonly liveGraphAuthoringPlanService: LiveGraphAuthoringPlanService,
    private readonly pedalboardService: PedalboardService,
    private readonly saveLoadedPedalboardService: SaveLoadedPedalboardService,
    private readonly clearCurrentPedalboardService: ClearCurrentPedalboardService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly sshClient: SshClient | null = null
  ) {}

  async execute(input: {
    plan: PedalboardPlan;
    confirm: boolean;
    title?: string;
    targetBundlepath?: string;
  }): Promise<ExecutePedalboardPlanResult> {
    const title = (input.title ?? this.defaultTitle(input.plan)).trim();
    if (!input.confirm) {
      return this.notAttempted(
        input.plan.operationMode,
        title,
        "Tool input must include confirm=true."
      );
    }

    const dryBundle = await this.dryBundleService.createDryBundle(input.plan);

    if (
      input.plan.operationMode === "new_board" ||
      input.plan.operationMode === "replace_current_board"
    ) {
      // /reset ensures a fully clean in-memory graph. Per-plugin removes via
      // clearCurrentPedalboardService are unreliable because /pedalboard/info/
      // (without bundlepath) returns 400 on some firmware versions, causing the
      // service to skip all removals silently.
      if (this.writeApi) {
        await this.writeApi.getBytes(
          "/reset",
          "reset board to ensure clean graph before live apply"
        );
      }
    }

    // For modify mode: read the bundle plugin list, load the bundle (sets active bundle =
    // target so asNew=0 will overwrite it), then remove each plugin individually.
    // We MUST NOT call /reset here — /reset also clears the active bundle designation,
    // which causes asNew=0 to create a new bundle instead of overwriting the target.
    if (
      input.plan.operationMode === "modify_current_board" &&
      input.targetBundlepath &&
      this.writeApi
    ) {
      const bundleInfo = await this.pedalboardService.inspectPedalboard(input.targetBundlepath);
      await this.writeApi.postForm(
        "/pedalboard/load_bundle/",
        { bundlepath: input.targetBundlepath },
        "load target bundle to set it as the active bundle for in-place save"
      );
      for (const plugin of bundleInfo.pluginsUsed) {
        await this.writeApi.getBytes(
          `/effect/remove/${uiGraphInstancePath(plugin.instance)}`,
          `remove existing plugin ${plugin.instance} before applying modified plan`
        );
      }
    }

    const authoringPlan = await this.liveGraphAuthoringPlanService.buildPlan(input.plan);
    if (!authoringPlan.validation.valid) {
      return {
        confirmed: true,
        operationMode: input.plan.operationMode,
        title,
        imported: false,
        saved: false,
        loaded: false,
        reportPath: await this.writeReport(
          title,
          input.plan,
          false,
          false,
          false,
          authoringPlan.notes
        ),
        apiCalls: [],
        notes: [...authoringPlan.notes, "Live graph plan validation failed before apply."]
      };
    }

    const liveApplyResult = await this.applyLiveGraphPlan(authoringPlan.apiCalls);
    if (!liveApplyResult.success) {
      return {
        confirmed: true,
        operationMode: input.plan.operationMode,
        title,
        imported: false,
        saved: false,
        loaded: false,
        reportPath: await this.writeReport(
          title,
          input.plan,
          false,
          false,
          false,
          liveApplyResult.notes
        ),
        apiCalls: liveApplyResult.apiCalls,
        notes: [...liveApplyResult.notes, "Live graph apply failed before save/load."]
      };
    }

    const expectedPluginUris = input.plan.signalChain
      .map((plugin) => plugin.uri)
      .filter((uri): uri is string => Boolean(uri));

    const expectedInstances = authoringPlan.plugins.map((plugin) => plugin.instance);
    const strayCleanup = await this.cleanupStrayPlugins(expectedInstances);

    // For modify_current_board: save in-place (asNew=0) to overwrite the loaded bundle.
    // For all other modes: save as a new bundle (asNew=1).
    const isModify =
      input.plan.operationMode === "modify_current_board" && Boolean(input.targetBundlepath);

    let savedTitle = title;
    let savedBundlepath: string | null = null;
    let saveFailed = false;
    const saveNotes: string[] = [];

    if (isModify) {
      const inPlaceResult = await this.doSaveInPlace(title);
      saveFailed = !inPlaceResult.ok;
      savedBundlepath = inPlaceResult.bundlepath;
      const expectedBundlepath = input.targetBundlepath!;
      if (inPlaceResult.ok) {
        if (savedBundlepath && savedBundlepath !== expectedBundlepath) {
          saveNotes.push(
            `Modified and saved in-place (bundlepath: ${savedBundlepath}).`
          );
        } else {
          saveNotes.push(`Modified and saved in-place: '${savedTitle}'.`);
        }
        saveNotes.push("/pedalboard/save called with asNew=0. /banks/save was not called.");
      } else {
        saveNotes.push("In-place save (asNew=0) failed after applying the live graph.");
      }
    }

    let saveResult: Awaited<ReturnType<typeof this.saveLoadedPedalboardService.saveAsNew>> | null =
      null;
    if (!isModify) {
      const saveAttempt = await this.saveLoadedPedalboardService.saveAsNew({
        title,
        confirm: true,
        expectedPluginUris,
        skipLoadedGraphValidation: true,
        inspectSavedBundle: true
      });

      saveResult = saveAttempt;
      if (!saveAttempt.saved.success && saveAttempt.targetExistsBefore) {
        savedTitle = await this.nextAvailableTitle(title);
        saveResult = await this.saveLoadedPedalboardService.saveAsNew({
          title: savedTitle,
          confirm: true,
          expectedPluginUris,
          skipLoadedGraphValidation: true,
          inspectSavedBundle: true
        });
      }
      saveFailed = !saveResult.saved.success;
      savedBundlepath = parseBundlePath(
        saveResult.saved.attempted && saveResult.saved.success ? saveResult.saved.body : undefined
      );
    }

    // After the bundle is on disk, write snapshots.json via SSH with the correct
    // snapshot names and computed parameter values. The HTTP /effect/parameter/set
    // endpoint only changes the live audio engine state — it does not update the
    // device's snapshot capture state, so values must be written directly to disk.
    const postSaveNotes: string[] = [];
    const hasSaved = !saveFailed;
    if (hasSaved && input.plan.snapshots.length > 0 && this.sshClient) {
      const bundlePathForSnapshots = isModify ? input.targetBundlepath! : savedBundlepath;
      if (bundlePathForSnapshots) {
        const content = this.liveGraphAuthoringPlanService.buildSnapshotsJsonContent(
          authoringPlan.plugins,
          input.plan.snapshots
        );
        try {
          await this.sshClient.sshWriteFile(`${bundlePathForSnapshots}/snapshots.json`, content);
          postSaveNotes.push(
            `Wrote ${input.plan.snapshots.length} named snapshots via SSH: ${input.plan.snapshots.map((s) => s.name).join(", ")}.`
          );
          // Reload the bundle so the device reads the new snapshots.json from disk
          // immediately. Without this, the UI still shows only "Default" until the
          // user manually reloads the board.
          if (this.writeApi) {
            await this.writeApi.postForm(
              "/pedalboard/load_bundle/",
              { bundlepath: bundlePathForSnapshots },
              "reload bundle so device reads new snapshots.json from disk"
            );
          }
        } catch (err) {
          postSaveNotes.push(
            `SSH snapshot write failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        postSaveNotes.push("Could not determine bundlepath for snapshot write.");
      }
    }

    const savedBundleMatches = isModify
      ? hasSaved
      : Boolean(saveResult?.saved.success) &&
        Boolean(saveResult?.savedBundleInspection) &&
        compareBundlePlugins(
          expectedPluginUris,
          saveResult?.savedBundleInspection?.pluginsUsed ?? []
        );
    const saved = savedBundleMatches;
    const loaded = saved;

    const notes = [
      ...authoringPlan.notes,
      ...liveApplyResult.notes,
      ...strayCleanup.notes,
      ...(saveResult?.notes ?? saveNotes),
      ...postSaveNotes,
      ...(saveResult?.savedBundleInspection &&
      !compareBundlePlugins(expectedPluginUris, saveResult.savedBundleInspection.pluginsUsed)
        ? ["Saved bundle plugin list did not exactly match the planned chain."]
        : []),
      saved
        ? isModify
          ? `Modified pedalboard saved in-place as '${savedTitle}'.`
          : `Saved as a new pedalboard as '${savedTitle}'.`
        : "Save failed after applying the live graph.",
      loaded ? "Live graph remains active after save." : "Active graph did not remain loaded."
    ];
    const reportPath = await this.writeReport(title, input.plan, true, saved, loaded, notes);

    return {
      confirmed: true,
      operationMode: input.plan.operationMode,
      title,
      imported: true,
      saved,
      loaded,
      reportPath,
      apiCalls: [...liveApplyResult.apiCalls, ...(saveResult?.apiCalls ?? [])],
      notes
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
      imported: false,
      saved: false,
      loaded: false,
      reportPath: null,
      apiCalls: [],
      notes: [error]
    };
  }

  private defaultTitle(plan: PedalboardPlan): string {
    return `${plan.request.instrument} ${plan.request.style}`.trim() || "MOD Dwarf Pedalboard";
  }

  private async nextAvailableTitle(baseTitle: string): Promise<string> {
    const pedalboards = await this.pedalboardService.listPedalboards("user");
    for (let index = 2; index < 10; index += 1) {
      const candidate = `${baseTitle} (${index})`;
      const taken = pedalboards.user.some(
        (pedalboard) =>
          normalizeTitle(pedalboard.title ?? pedalboard.bundlePath.split("/").pop() ?? "") ===
          normalizeTitle(candidate)
      );
      if (!taken) {
        return candidate;
      }
    }
    return `${baseTitle} (${Date.now()})`;
  }

  private async cleanupStrayPlugins(
    expectedInstances: string[]
  ): Promise<{ removed: string[]; failed: string[]; notes: string[] }> {
    if (!this.writeApi) return { removed: [], failed: [], notes: [] };

    try {
      const response = await this.writeApi.getJson<{
        plugins?: Array<{ instance?: string; uri?: string }>;
      }>("/pedalboard/info/", "inspect active graph for stray plugins after live apply");

      if (!response.ok || !response.value) {
        return { removed: [], failed: [], notes: [] };
      }

      const expectedSet = new Set(expectedInstances.map(normalizeGraphInstance));
      const strayInstances: string[] = [];

      for (const plugin of response.value.plugins ?? []) {
        const normalized = normalizeGraphInstance(plugin.instance ?? "");
        if (normalized && !expectedSet.has(normalized)) {
          strayInstances.push(normalized);
        }
      }

      if (strayInstances.length === 0) {
        return { removed: [], failed: [], notes: [] };
      }

      const removed: string[] = [];
      const failed: string[] = [];

      for (const instance of strayInstances) {
        const path = `/effect/remove/${uiGraphInstancePath(instance)}`;
        const removeResponse = await this.writeApiOrThrow().getBytes(
          path,
          `remove stray plugin ${instance} left from a previous pedalboard`
        );
        if (removeResponse.ok) {
          removed.push(instance);
        } else {
          failed.push(instance);
        }
      }

      const notes: string[] = [];
      if (removed.length > 0) {
        notes.push(
          `Removed ${removed.length} stray plugin instance(s) left from a previous board: ${removed.join(", ")}.`
        );
      }
      if (failed.length > 0) {
        notes.push(
          `Failed to remove ${failed.length} stray plugin instance(s): ${failed.join(", ")}.`
        );
      }
      return { removed, failed, notes };
    } catch {
      return { removed: [], failed: [], notes: [] };
    }
  }

  private async applyLiveGraphPlan(apiCalls: LiveGraphApiCall[]): Promise<{
    success: boolean;
    apiCalls: Array<{
      method: "GET" | "POST";
      path: string;
      purpose: string;
      status: "success" | "failed" | "skipped";
      httpStatus?: number;
      error?: string;
    }>;
    notes: string[];
  }> {
    if (!this.writeApi) {
      return {
        success: false,
        apiCalls: [],
        notes: ["Write API is not configured."]
      };
    }

    const executed: Array<{
      method: "GET" | "POST";
      path: string;
      purpose: string;
      status: "success" | "failed" | "skipped";
      httpStatus?: number;
      error?: string;
    }> = [];

    for (const call of apiCalls) {
      if (call.path === "/pedalboard/save") continue;
      const response = await this.executeLiveCall(call);
      executed.push({
        method: call.method,
        path: call.path,
        purpose: call.purpose,
        status: response.ok ? "success" : "failed",
        httpStatus: response.status,
        error: response.ok ? undefined : response.text.slice(0, 500)
      });
      if (!response.ok) {
        return {
          success: false,
          apiCalls: executed,
          notes: [`Live graph call failed: ${call.path} -> HTTP ${response.status}`]
        };
      }
    }

    return {
      success: true,
      apiCalls: executed,
      notes: ["Applied the live graph directly through MOD UI API endpoints."]
    };
  }

  private async executeLiveCall(call: LiveGraphApiCall) {
    const body = call.body ?? { kind: "none" as const };
    const path = normalizeLiveCallPath(call.path);
    if (call.method === "GET" || body.kind === "none") {
      return this.writeApiOrThrow().getBytes(path, call.purpose);
    }
    if (body.kind === "form") {
      return this.writeApiOrThrow().postForm(path, body.fields, call.purpose);
    }
    if (body.kind === "json") {
      return this.writeApiOrThrow().postJson(path, body.value, call.purpose);
    }
    return this.writeApiOrThrow().getBytes(path, call.purpose);
  }

  private async doSaveInPlace(
    title: string
  ): Promise<{ ok: boolean; bundlepath: string | null }> {
    if (!this.writeApi) return { ok: false, bundlepath: null };
    try {
      const response = await this.writeApi.postForm(
        "/pedalboard/save",
        { title, asNew: 0 },
        "save in-place to overwrite the active bundle (modify_current_board mode)"
      );
      return { ok: response.ok, bundlepath: parseBundlePath(response.text) };
    } catch {
      return { ok: false, bundlepath: null };
    }
  }

  private writeApiOrThrow(): WriteHttpClient {
    if (!this.writeApi) throw new Error("Write API is not configured");
    return this.writeApi;
  }

  private async writeReport(
    title: string,
    plan: PedalboardPlan,
    imported: boolean,
    saved: boolean,
    loaded: boolean,
    notes: string[]
  ): Promise<string | null> {
    try {
      await mkdir("final_reports", { recursive: true });
      const stamp = timestamp();
      const path = join("final_reports", `execute_${stamp}.txt`);
      const body = [
        `title: ${title}`,
        `operationMode: ${plan.operationMode}`,
        `imported: ${imported}`,
        `saved: ${saved}`,
        `loaded: ${loaded}`,
        "",
        "snapshots:",
        ...plan.snapshots.map((snapshot) => `- ${snapshot.name}: ${snapshot.description}`),
        "",
        "notes:",
        ...notes.map((note) => `- ${note}`)
      ].join("\n");
      await writeFile(path, `${body}\n`, "utf8");
      return path;
    } catch {
      return null;
    }
  }
}

function normalizeGraphInstance(value: string): string {
  return value
    .trim()
    .replace(/^(?:\/graph\/|graph\/)/, "")
    .replace(/^\//, "");
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\.pedalboard$/, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function compareBundlePlugins(
  expectedPluginUris: string[],
  actualPlugins: Array<{ uri: string }>
): boolean {
  const actualPluginUris = actualPlugins.map((plugin) => plugin.uri).filter(Boolean);
  if (actualPluginUris.length !== expectedPluginUris.length) return false;
  const expected = [...expectedPluginUris].sort();
  const actual = [...actualPluginUris].sort();
  return expected.every((uri, index) => uri === actual[index]);
}

function normalizeLiveCallPath(path: string): string {
  const prefix = "/effect/connect/";
  if (!path.startsWith(prefix)) return path;
  const payload = path.slice(prefix.length);
  if (payload.includes("/graph/")) return path;
  const [source, target] = payload.split(",", 2);
  if (!source || !target) return path;
  return `/effect/connect/${uiGraphRef(source)},${uiGraphRef(target)}`;
}

function parseBundlePath(responseBody: string | undefined): string | null {
  if (!responseBody) return null;
  try {
    const parsed = JSON.parse(responseBody) as { bundlepath?: string };
    return typeof parsed?.bundlepath === "string" ? parsed.bundlepath : null;
  } catch {
    return null;
  }
}
