import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DryBundleService } from "./dryBundleService.js";
import type { ImportBundleService } from "./importBundleService.js";
import type { LoadExistingPedalboardService } from "./loadExistingPedalboardService.js";
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
    private readonly saveLoadedPedalboardService: SaveLoadedPedalboardService,
    private readonly loadExistingPedalboardService: LoadExistingPedalboardService
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

    const saveResult = await this.saveLoadedPedalboardService.saveAsNew({
      title,
      confirm: true,
      expectedPluginUris: input.plan.signalChain.map((plugin) => plugin.uri).filter(Boolean) as string[],
      loadedBundlePath: dryBundle.bundlePath
    });

    const saved = Boolean(saveResult.saved.success);
    const savedBundlePath = saveResult.matchingPedalboards[0]?.bundlePath ?? null;
    let loaded = false;
    let loadNotes: string[] = [];
    let loadApiCalls: ExecutePedalboardPlanResult["apiCalls"] = [];

    if (saved && savedBundlePath) {
      const loadResult = await this.loadExistingPedalboardService.load({
        bundlePath: savedBundlePath,
        confirm: true
      });
      loaded = Boolean(loadResult.load.success);
      loadNotes = loadResult.notes;
      loadApiCalls = loadResult.apiCalls;
    }

    const notes = [
      ...importResult.notes,
      ...saveResult.notes,
      ...loadNotes,
      saved ? "Saved as a new pedalboard after import." : "Save failed after import.",
      loaded ? "Reloaded the saved pedalboard." : "Reload after save did not complete."
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
      apiCalls: [...importResult.apiCalls, ...saveResult.apiCalls, ...loadApiCalls],
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
