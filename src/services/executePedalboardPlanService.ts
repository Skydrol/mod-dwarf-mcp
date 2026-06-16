import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { DryBundleService } from "./dryBundleService.js";
import type { ImportBundleService } from "./importBundleService.js";
import type { PedalboardService } from "./pedalboardService.js";
import type { SaveLoadedPedalboardService } from "./saveLoadedPedalboardService.js";
import type { PedalboardPlan } from "../types/plan.js";

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
    private readonly importBundleService: ImportBundleService,
    private readonly pedalboardService: PedalboardService,
    private readonly saveLoadedPedalboardService: SaveLoadedPedalboardService,
    private readonly writeApi: WriteHttpClient | null
  ) {}

  async execute(input: {
    plan: PedalboardPlan;
    confirm: boolean;
    title?: string;
  }): Promise<ExecutePedalboardPlanResult> {
    const title = (input.title ?? this.defaultTitle(input.plan)).trim();
    if (!input.confirm) {
      return this.notAttempted(input.plan.operationMode, title, "Tool input must include confirm=true.");
    }

    const dryBundle = await this.dryBundleService.createDryBundle(input.plan);
    if (input.plan.operationMode === "new_board" || input.plan.operationMode === "replace_current_board") {
      await this.resetBoard();
    }
    const importResult = await this.importBundleService.importDryBundle({
      dryBundle,
      confirm: true,
      targetName: title
    });

    if (!importResult.import.success) {
      return {
        confirmed: true,
        operationMode: input.plan.operationMode,
        title,
        imported: false,
        saved: false,
        loaded: false,
        reportPath: await this.writeReport(title, input.plan, false, false, false, importResult.notes),
        apiCalls: importResult.apiCalls,
        notes: [...importResult.notes, "Import failed before save/load."]
      };
    }

    const expectedPluginUris = input.plan.signalChain
      .map((plugin) => plugin.uri)
      .filter((uri): uri is string => Boolean(uri));
    const saveAttempt = await this.saveLoadedPedalboardService.saveAsNew({
      title,
      confirm: true,
      expectedPluginUris,
      loadedBundlePath: `/tmp/pedalboards/${basename(dryBundle.bundlePath)}`,
      inspectSavedBundle: false
    });

    let saveResult = saveAttempt;
    let savedTitle = title;
    if (!saveAttempt.saved.success && saveAttempt.targetExistsBefore) {
      savedTitle = await this.nextAvailableTitle(title);
      saveResult = await this.saveLoadedPedalboardService.saveAsNew({
        title: savedTitle,
        confirm: true,
        expectedPluginUris,
        loadedBundlePath: `/tmp/pedalboards/${basename(dryBundle.bundlePath)}`,
        inspectSavedBundle: false
      });
    }

    const saved = Boolean(saveResult.saved.success);
    const loaded = saved;

    const notes = [
      ...importResult.notes,
      ...saveResult.notes,
      saved ? `Saved as a new pedalboard as '${savedTitle}'.` : "Save failed after import.",
      loaded ? "Imported bundle remains active after save." : "Active graph did not remain loaded."
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
      apiCalls: [...importResult.apiCalls, ...saveResult.apiCalls],
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

  private async resetBoard(): Promise<void> {
    if (!this.writeApi) return;
    try {
      await this.writeApi.getBytes("/reset", "reset board before prompt execution");
    } catch {
      // Best effort; import will still run and report its own status.
    }
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
  return value.replace(/\.pedalboard$/, "").replace(/_/g, " ").trim().toLowerCase();
}
