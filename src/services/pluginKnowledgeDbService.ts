import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PluginKnowledgeDb, PluginKnowledgeEntry } from "../types/pluginKnowledgeDb.js";

const DEFAULT_KNOWLEDGE_DB_PATH = "data/pluginKnowledgeDb.json";

export class PluginKnowledgeDbService {
  constructor(private readonly knowledgeDbPath: string = DEFAULT_KNOWLEDGE_DB_PATH) {}

  async load(): Promise<PluginKnowledgeDb | null> {
    try {
      const absolutePath = resolve(process.cwd(), this.knowledgeDbPath);
      const raw = await readFile(absolutePath, "utf8");
      const parsed = JSON.parse(raw) as PluginKnowledgeDb;
      if (!parsed || !Array.isArray(parsed.plugins)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async lookupByUri(uri: string): Promise<PluginKnowledgeEntry | null> {
    const db = await this.load();
    return db?.plugins.find((plugin) => plugin.uri === uri) ?? null;
  }

  async lookupAll(): Promise<PluginKnowledgeEntry[]> {
    const db = await this.load();
    return db?.plugins ?? [];
  }
}
