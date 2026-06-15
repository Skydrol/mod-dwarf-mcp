import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CommandRunner } from "../clients/sshClient.js";
import type {
  DeviceInventory,
  DeviceInventoryControlPort,
  DeviceInventoryPlugin
} from "../types/deviceInventory.js";
import type { RefreshDeviceInventoryResult } from "../types/refreshDeviceInventory.js";
import { lines, parseKernel, parseOsRelease, parseLv2InfoPorts } from "./parsers.js";
import { readFile, shellQuote } from "./sshUtils.js";

const INVENTORY_PATH = "data/deviceInventory.json";

export class DeviceInventoryService {
  constructor(
    private readonly ssh: CommandRunner,
    private readonly outputPath: string = INVENTORY_PATH
  ) {}

  async refresh(): Promise<RefreshDeviceInventoryResult> {
    const [firmware, osRelease, uname, pluginUris, pluginNames] = await Promise.all([
      readFile(this.ssh, "/etc/mod-release/release"),
      readFile(this.ssh, "/etc/os-release"),
      this.ssh.exec("uname -a"),
      this.ssh.exec("lv2ls"),
      this.ssh.exec("lv2ls -n")
    ]);

    const uriList = lines(pluginUris.stdout);
    const nameList = lines(pluginNames.stdout);
    const plugins: DeviceInventoryPlugin[] = [];
    for (const [index, uri] of uriList.entries()) {
      const name = nameList[index] ?? uri;
      const info = await this.readPluginInfo(uri);
      plugins.push(buildPluginRecord(uri, name, info, null));
    }

    const sortedPlugins = plugins.sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) return byName;
      return left.uri.localeCompare(right.uri);
    });

    const inventory: DeviceInventory = {
      generatedAt: new Date().toISOString(),
      device: {
        firmware: firmware?.trim() || null,
        os: osRelease
          ? [parseOsRelease(osRelease).name, parseOsRelease(osRelease).version]
              .filter(Boolean)
              .join(" ") || null
          : null,
        kernel: parseKernel(uname.stdout).kernel || null
      },
      plugins: sortedPlugins
    };

    const absolutePath = resolve(process.cwd(), this.outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, JSON.stringify(inventory, null, 2) + "\n", "utf8");

    return {
      pluginCount: sortedPlugins.length,
      newInventoryWritten: true,
      inventoryPath: this.outputPath
    };
  }

  private async readPluginInfo(uri: string): Promise<{
    ports: Array<{
      kind: string;
      direction: string;
      symbol: string;
      name: string | null;
      minimum?: number;
      maximum?: number;
      default?: number;
      unit?: string;
    }>;
  } | null> {
    try {
      const result = await this.ssh.exec(`lv2info ${shellQuote(uri)}`);
      if (result.code !== 0) return null;
      return parseLv2InfoPorts(result.stdout, uri);
    } catch {
      return null;
    }
  }
}

function buildPluginRecord(
  uri: string,
  name: string,
  info: unknown,
  category: string | null
): DeviceInventoryPlugin {
  const ports = isParsedPortsInfo(info) ? info.ports : [];
  const audioInputs = ports.filter(
    (port) => port.kind === "audio" && port.direction === "input"
  ).length;
  const audioOutputs = ports.filter(
    (port) => port.kind === "audio" && port.direction === "output"
  ).length;
  const controlPorts: DeviceInventoryControlPort[] = ports
    .filter((port) => port.kind === "control")
    .map((port) => ({
      symbol: port.symbol,
      name: port.name,
      minimum: typeof port.minimum === "number" ? port.minimum : null,
      maximum: typeof port.maximum === "number" ? port.maximum : null,
      default: typeof port.default === "number" ? port.default : null,
      unit: port.unit ?? null
    }));

  return { uri, name, category, audioInputs, audioOutputs, controlPorts };
}

function isParsedPortsInfo(value: unknown): value is {
  ports: Array<{
    kind: string;
    direction: string;
    symbol: string;
    name: string | null;
    minimum?: number;
    maximum?: number;
    default?: number;
    unit?: string;
  }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "ports" in value &&
    Array.isArray((value as { ports?: unknown }).ports)
  );
}
