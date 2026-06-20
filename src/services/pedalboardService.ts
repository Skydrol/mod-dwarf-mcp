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

export interface BundleRawFiles {
  manifestText: string | null;
  mainTtlText: string | null;
  mainTtlFileName: string | null;
  snapshotsText: string | null;
  addressingsText: string | null;
}

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
    // Run find and grep in parallel: 2 SSH connections instead of up to ~440 sequential ones.
    // grep -r extracts every doap:name line from every TTL file in one shot.
    const [findResult, grepResult] = await Promise.all([
      this.ssh.exec(`find ${shellQuote(path)} -maxdepth 2 -print`),
      this.ssh.exec(`grep -r 'doap:name' ${shellQuote(path)}`)
    ]);

    const entries = findResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const entrySet = new Set(entries);
    const bundles = entries
      .filter((entry) => entry.endsWith(".pedalboard"))
      .filter((entry) => entry.split("/").length === path.split("/").length + 1)
      .sort();

    // Build bundlePath → title map from grep output.
    // Lines look like: "/path/to/Board.pedalboard/Board.ttl:   doap:name "Title" ;"
    // Prefer main TTL over manifest.ttl (main has the authoritative pedalboard title).
    const manifestTitles = new Map<string, string>();
    const mainTitles = new Map<string, string>();
    for (const line of grepResult.stdout.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 1) continue;
      const filePath = line.substring(0, colonIdx).trim();
      const content = line.substring(colonIdx + 1);
      const nameMatch = content.match(/doap:name\s+"([^"]+)"/);
      if (!nameMatch) continue;
      const title = nameMatch[1];
      const bundlePath = bundles.find((b) => filePath.startsWith(b + "/"));
      if (!bundlePath) continue;
      if (filePath.endsWith("/manifest.ttl")) {
        if (!manifestTitles.has(bundlePath)) manifestTitles.set(bundlePath, title);
      } else if (filePath.endsWith(".ttl")) {
        if (!mainTitles.has(bundlePath)) mainTitles.set(bundlePath, title);
      }
    }

    return bundles.map((bundlePath) => ({
      title:
        mainTitles.get(bundlePath) ??
        manifestTitles.get(bundlePath) ??
        this.titleFromPath(bundlePath),
      bundlePath,
      source,
      hasManifest: entrySet.has(`${bundlePath}/manifest.ttl`),
      hasSnapshots: entrySet.has(`${bundlePath}/snapshots.json`),
      hasPresets: entrySet.has(`${bundlePath}/presets.json`),
      hasAddressings: entrySet.has(`${bundlePath}/addressings.json`)
    }));
  }

  private async resolvePedalboardTitle(
    bundlePath: string,
    knownEntries: string[]
  ): Promise<string | null> {
    const manifestPath = `${bundlePath}/manifest.ttl`;
    const manifest = knownEntries.includes(manifestPath)
      ? await readFile(this.ssh, manifestPath)
      : null;
    const mainFile = manifest ? extractMainTtlFromManifest(manifest) : null;
    const mainTtlPath = mainFile
      ? `${bundlePath}/${mainFile}`
      : (knownEntries.find(
          (entry) =>
            entry.startsWith(`${bundlePath}/`) &&
            entry.endsWith(".ttl") &&
            !entry.endsWith("/manifest.ttl")
        ) ?? null);
    const mainTtl = mainTtlPath ? await readFile(this.ssh, mainTtlPath) : null;
    return mainTtl
      ? (extractDoapName(mainTtl) ?? this.titleFromPath(bundlePath))
      : this.titleFromPath(bundlePath);
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

  async getCurrentBoardPath(): Promise<string | null> {
    // MOD OS stores the last-loaded bundle path in this file.
    const result = await readFile(this.ssh, "/root/data/last-pedalboard");
    if (result && result.trim().length > 0) return result.trim();
    // Fallback: try a symlink that some MOD firmware versions use.
    const link = await this.ssh.exec("readlink /root/.pedalboards/current");
    if (link.code === 0 && link.stdout.trim().length > 0) return link.stdout.trim();
    return null;
  }

  async readBundleFiles(bundlePath: string): Promise<BundleRawFiles> {
    const manifestText = await readFile(this.ssh, `${bundlePath}/manifest.ttl`);
    const mainTtlFile = manifestText ? extractMainTtlFromManifest(manifestText) : null;
    const mainTtlPath = mainTtlFile
      ? `${bundlePath}/${mainTtlFile}`
      : await this.findFirstTtl(bundlePath);
    const mainTtlText = mainTtlPath ? await readFile(this.ssh, mainTtlPath) : null;
    const mainTtlFileName = mainTtlPath ? (mainTtlPath.split("/").pop() ?? null) : null;
    const snapshotsText = await readFile(this.ssh, `${bundlePath}/snapshots.json`);
    const addressingsText = await readFile(this.ssh, `${bundlePath}/addressings.json`);
    return { manifestText, mainTtlText, mainTtlFileName, snapshotsText, addressingsText };
  }

  async pedalboardTitleExists(
    title: string,
    source: "user" | "factory" | "all" = "all"
  ): Promise<boolean> {
    const normalizedTarget = this.normalizeTitle(title);
    const sources =
      source === "all"
        ? [USER_PEDALBOARDS, FACTORY_PEDALBOARDS]
        : source === "user"
          ? [USER_PEDALBOARDS]
          : [FACTORY_PEDALBOARDS];

    for (const path of sources) {
      const result = await this.ssh.exec(
        `find ${shellQuote(path)} -maxdepth 2 -name '*.pedalboard' -type d`
      );
      const bundles = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const bundlePath of bundles) {
        const title = await this.resolvePedalboardTitle(bundlePath, []);
        if (title && this.normalizeTitle(title) === normalizedTarget) return true;
      }
    }
    return false;
  }

  private normalizeTitle(value: string): string {
    return value
      .replace(/\.pedalboard$/, "")
      .replace(/_/g, " ")
      .trim()
      .toLowerCase();
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
