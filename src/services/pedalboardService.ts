import type { CommandRunner } from "../clients/sshClient.js";
import type {
  PedalboardInspection,
  PedalboardList,
  PedalboardSource,
  PedalboardSummary
} from "../types/pedalboard.js";
import {
  extractConnections,
  extractDoapName,
  extractMainTtlFromManifest,
  extractPluginsUsed
} from "./parsers.js";
import { readFile, shellQuote, testFile } from "./sshUtils.js";
import { SnapshotService } from "./snapshotService.js";

const USER_PEDALBOARDS = "/root/.pedalboards";
const FACTORY_PEDALBOARDS = "/usr/share/mod/pedalboards";

export class PedalboardService {
  private readonly snapshotService: SnapshotService;

  constructor(private readonly ssh: CommandRunner) {
    this.snapshotService = new SnapshotService(ssh);
  }

  async listPedalboards(source: "user" | "factory" | "all" = "all"): Promise<PedalboardList> {
    const [user, factory] = await Promise.all([
      source === "factory"
        ? Promise.resolve([])
        : this.listPedalboardSource(USER_PEDALBOARDS, "user"),
      source === "user"
        ? Promise.resolve([])
        : this.listPedalboardSource(FACTORY_PEDALBOARDS, "factory")
    ]);
    return { user, factory };
  }

  async inspectPedalboard(bundlePath: string): Promise<PedalboardInspection> {
    const manifestPath = `${bundlePath}/manifest.ttl`;
    const manifest = await readFile(this.ssh, manifestPath);
    const mainFile = manifest ? extractMainTtlFromManifest(manifest) : null;
    const mainTtlPath = mainFile
      ? `${bundlePath}/${mainFile}`
      : await this.findFirstTtl(bundlePath);
    const mainTtl = mainTtlPath ? await readFile(this.ssh, mainTtlPath) : null;
    const addressingsPath = `${bundlePath}/addressings.json`;
    const snapshotsPath = `${bundlePath}/snapshots.json`;
    const presetsPath = `${bundlePath}/presets.json`;
    const addressingsText = await readFile(this.ssh, addressingsPath);
    const snapshots = await this.snapshotService.listSnapshots(bundlePath);

    const files = {
      manifest: manifest ? manifestPath : null,
      mainTtl: mainTtl ? mainTtlPath : null,
      addressings: addressingsText ? addressingsPath : null,
      snapshots: (await testFile(this.ssh, snapshotsPath)) ? snapshotsPath : null,
      presets: (await testFile(this.ssh, presetsPath)) ? presetsPath : null,
      thumbnail: (await testFile(this.ssh, `${bundlePath}/thumbnail.png`))
        ? `${bundlePath}/thumbnail.png`
        : null,
      screenshot: (await testFile(this.ssh, `${bundlePath}/screenshot.png`))
        ? `${bundlePath}/screenshot.png`
        : null
    };

    return {
      bundlePath,
      title: mainTtl ? extractDoapName(mainTtl) : this.titleFromPath(bundlePath),
      source: this.sourceFromPath(bundlePath),
      files,
      pluginsUsed: mainTtl ? extractPluginsUsed(mainTtl) : [],
      connections: mainTtl ? extractConnections(mainTtl) : [],
      mappings: addressingsText ? JSON.parse(addressingsText) : null,
      snapshots: snapshots.snapshots,
      metadata: {
        format: "lv2-bundle",
        ttlBased: true,
        jsonSidecars: [files.addressings, files.snapshots, files.presets].filter(
          Boolean
        ) as string[]
      }
    };
  }

  private async listPedalboardSource(
    path: string,
    source: "user" | "factory"
  ): Promise<PedalboardSummary[]> {
    const result = await this.ssh.exec(`find ${shellQuote(path)} -maxdepth 2 -print`);
    const entries = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const entrySet = new Set(entries);
    const bundles = entries
      .filter((entry) => entry.endsWith(".pedalboard"))
      .filter((entry) => entry.split("/").length === path.split("/").length + 1)
      .sort();

    return bundles.map((bundlePath) => {
      const basename = bundlePath.split("/").pop() ?? bundlePath;
      return {
        title: basename.replace(/\.pedalboard$/, "").replace(/_/g, " "),
        bundlePath,
        source,
        hasManifest: entrySet.has(`${bundlePath}/manifest.ttl`),
        hasSnapshots: entrySet.has(`${bundlePath}/snapshots.json`),
        hasPresets: entrySet.has(`${bundlePath}/presets.json`),
        hasAddressings: entrySet.has(`${bundlePath}/addressings.json`)
      };
    });
  }

  private async findFirstTtl(bundlePath: string): Promise<string | null> {
    const result = await this.ssh.exec(
      `find ${shellQuote(bundlePath)} -maxdepth 1 -type f -name '*.ttl' -print`
    );
    return (
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .find((path) => !path.endsWith("/manifest.ttl")) ?? null
    );
  }

  private sourceFromPath(bundlePath: string): PedalboardSource {
    if (
      bundlePath.startsWith(USER_PEDALBOARDS) ||
      bundlePath.startsWith("/data/root/.pedalboards")
    ) {
      return "user";
    }
    if (bundlePath.startsWith(FACTORY_PEDALBOARDS)) return "factory";
    return "unknown";
  }

  private titleFromPath(bundlePath: string): string | null {
    return (
      bundlePath
        .split("/")
        .pop()
        ?.replace(/\.pedalboard$/, "")
        .replace(/_/g, " ") ?? null
    );
  }
}
