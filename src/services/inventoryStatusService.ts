import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface InventoryStatus {
  exists: boolean;
  pluginCount: number;
  generatedAt: string | null;
  ageHours: number | null;
  isStale: boolean;
  message: string;
}

const STALE_THRESHOLD_HOURS = 72;
const DB_PATH = "data/pluginKnowledgeDb.json";

export class InventoryStatusService {
  async getStatus(): Promise<InventoryStatus> {
    const absolutePath = resolve(process.cwd(), DB_PATH);
    try {
      const raw = await readFile(absolutePath, "utf8");
      const db = JSON.parse(raw) as { generatedAt?: string; plugins?: unknown[] };
      const generatedAt = db.generatedAt ?? null;
      const pluginCount = Array.isArray(db.plugins) ? db.plugins.length : 0;
      const ageMs = generatedAt ? Date.now() - new Date(generatedAt).getTime() : null;
      const ageHours = ageMs !== null ? Math.round((ageMs / 3_600_000) * 10) / 10 : null;
      const isStale = ageHours !== null && ageHours > STALE_THRESHOLD_HOURS;
      return {
        exists: true,
        pluginCount,
        generatedAt,
        ageHours,
        isStale,
        message: isStale
          ? `Inventory is stale (${ageHours}h old). Run refresh_device_inventory to update.`
          : `Inventory is current: ${pluginCount} plugins indexed, generated ${ageHours ?? "?"}h ago.`
      };
    } catch {
      return {
        exists: false,
        pluginCount: 0,
        generatedAt: null,
        ageHours: null,
        isStale: true,
        message:
          "Inventory not found. You MUST run refresh_device_inventory before creating pedalboards. " +
          "Without it, only 34 hardcoded plugins are visible instead of the full 200+ device inventory."
      };
    }
  }
}
