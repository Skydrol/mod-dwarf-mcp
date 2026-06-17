import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CommandRunner } from "../clients/sshClient.js";
import type { PluginList, PluginPortInfo } from "../types/plugin.js";
import { lines, parseLv2InfoPorts } from "./parsers.js";
import { shellQuote } from "./sshUtils.js";
import type { PluginCatalogEntry } from "../data/pluginCatalog.js";

interface DeviceInventoryFile {
  plugins?: Array<{ name?: string; uri?: string }>;
}

const DEFAULT_DEVICE_INVENTORY_PATH = "data/deviceInventory.json";

export class PluginService {
  constructor(
    private readonly ssh: CommandRunner | null,
    private readonly catalog: PluginCatalogEntry[] = []
  ) {}

  async listPlugins(format: "names" | "uris" | "both" = "both"): Promise<PluginList> {
    if (this.catalog.length > 0) {
      return listPluginsFromCatalog(this.catalog, format);
    }
    if (!this.ssh) {
      throw new Error("Plugin catalog is empty and no SSH fallback is configured");
    }

    const [urisResult, namesResult] = await Promise.all([
      format === "names" ? Promise.resolve(null) : this.ssh.exec("lv2ls"),
      format === "uris" ? Promise.resolve(null) : this.ssh.exec("lv2ls -n")
    ]);

    const uris = urisResult ? lines(urisResult.stdout) : [];
    const names = namesResult ? lines(namesResult.stdout) : [];

    if (format === "uris") {
      return { count: uris.length, plugins: uris.map((uri) => ({ uri })) };
    }
    if (format === "names") {
      return { count: names.length, plugins: names.map((name) => ({ name })) };
    }

    const count = Math.max(uris.length, names.length);
    return {
      count,
      plugins: Array.from({ length: count }, (_, index) => ({
        name: names[index],
        uri: uris[index]
      }))
    };
  }

  async getPluginPorts(uri: string): Promise<PluginPortInfo> {
    const cached = this.catalog.find((plugin) => plugin.uri === uri);
    if (cached) {
      return normalizeCatalogEntry(cached);
    }
    if (!this.ssh) {
      throw new Error(
        `Plugin metadata not found in local catalog and no SSH fallback is configured: ${uri}`
      );
    }

    const result = await this.ssh.exec(`lv2info ${shellQuote(uri)}`);
    if (result.code !== 0) {
      return { uri, ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
    }
    return parseLv2InfoPorts(result.stdout, uri);
  }
}

function listPluginsFromCatalog(
  catalog: PluginCatalogEntry[],
  format: "names" | "uris" | "both"
): PluginList {
  if (format === "uris") {
    return { count: catalog.length, plugins: catalog.map((plugin) => ({ uri: plugin.uri })) };
  }
  if (format === "names") {
    return { count: catalog.length, plugins: catalog.map((plugin) => ({ name: plugin.name })) };
  }

  return {
    count: catalog.length,
    plugins: catalog.map((plugin) => ({ name: plugin.name, uri: plugin.uri }))
  };
}

function normalizeCatalogEntry(entry: PluginCatalogEntry): PluginPortInfo {
  const audioInputs = entry.ports.filter(
    (port) => port.kind === "audio" && port.direction === "input"
  );
  const audioOutputs = entry.ports.filter(
    (port) => port.kind === "audio" && port.direction === "output"
  );
  const controlInputs = entry.ports.filter(
    (port) => port.kind === "control" && port.direction === "input"
  );
  return {
    uri: entry.uri,
    ports: entry.ports,
    audioInputs,
    audioOutputs,
    controlInputs
  };
}

async function loadDeviceInventory(): Promise<DeviceInventoryFile | null> {
  try {
    const absolutePath = resolve(process.cwd(), DEFAULT_DEVICE_INVENTORY_PATH);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as DeviceInventoryFile;
    if (!parsed || !Array.isArray(parsed.plugins)) return null;
    return parsed;
  } catch {
    return null;
  }
}
