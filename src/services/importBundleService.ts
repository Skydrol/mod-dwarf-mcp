import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { basename, dirname, join, relative } from "node:path";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import type { DryPedalboardBundle } from "../types/dryBundle.js";
import type { ImportDryBundleResult, LoadedGraphValidation } from "../types/importBundle.js";
import type { PedalboardSummary } from "../types/pedalboard.js";
import type { PedalboardService } from "./pedalboardService.js";

const IMPORT_ENDPOINT = "/pedalboard/load_web/";

export class ImportBundleService {
  constructor(
    private readonly pedalboardService: PedalboardService,
    private readonly writeApi: WriteHttpClient | null,
    private readonly writeToolsEnabled: boolean
  ) {}

  async importDryBundle(input: {
    dryBundle: DryPedalboardBundle;
    confirm: boolean;
    targetName?: string;
  }): Promise<ImportDryBundleResult> {
    const targetName =
      input.targetName?.trim() || this.targetNameFromBundle(input.dryBundle.bundlePath);

    if (!this.writeToolsEnabled || !this.writeApi) {
      return this.disabledResult(input.confirm, targetName);
    }
    if (!input.confirm) {
      return this.unconfirmedResult(targetName);
    }

    const verification = await this.verifyGeneratedDryBundle(input.dryBundle);
    if (!verification.ok) {
      return {
        writeToolsEnabled: true,
        confirmed: true,
        dryRunSourceVerified: false,
        targetName,
        targetExists: false,
        backup: { required: false, created: false },
        import: { attempted: false, success: false, error: verification.error },
        localArchivePath: null,
        apiCalls: [...this.writeApi.calls],
        directFileWrites: false,
        notes: [
          "Import aborted before any API write because the input was not a verified generated dry bundle."
        ]
      };
    }

    const existing = await this.findExistingTarget(targetName);
    const archivePath = await this.createTarGzArchive(input.dryBundle);

    if (existing) {
      const backup = await this.createBackup(existing, input.dryBundle.directoryPath, targetName);
      if (!backup.created) {
        return {
          writeToolsEnabled: true,
          confirmed: true,
          dryRunSourceVerified: true,
          targetName,
          targetExists: true,
          backup,
          import: { attempted: false, success: false, error: backup.error },
          localArchivePath: archivePath,
          apiCalls: [...this.writeApi.calls],
          directFileWrites: false,
          notes: [
            "Import aborted because an existing target requires a backup and API export failed."
          ]
        };
      }
    }

    const importResult = await this.importArchive(archivePath);
    let loadedGraphValidation: LoadedGraphValidation | undefined;
    if (importResult.success) {
      await this.activateBundle(input.dryBundle.bundlePath);
      loadedGraphValidation = await this.validateLoadedGraph(input.dryBundle);
    }
    return {
      writeToolsEnabled: true,
      confirmed: true,
      dryRunSourceVerified: true,
      targetName,
      targetExists: Boolean(existing),
      backup: existing
        ? await this.latestBackupResult(input.dryBundle.directoryPath, targetName)
        : { required: false, created: false },
      import: importResult,
      localArchivePath: archivePath,
      loadedGraphValidation,
      apiCalls: [...this.writeApi.calls],
      directFileWrites: false,
      notes: [
        importResult.success
          ? "Imported and activated through MOD UI API endpoints."
          : "API import failed. No direct file-write fallback was attempted."
      ]
    };
  }

  private async activateBundle(bundlePath: string): Promise<void> {
    const deviceBundlePath = `/tmp/pedalboards/${basename(bundlePath)}`;
    const response = await this.writeApiOrThrow().postForm(
      "/pedalboard/load_bundle/",
      { bundlepath: deviceBundlePath },
      "explicitly activate imported bundle"
    );
    if (!response.ok) {
      throw new Error(`Failed to activate bundle ${deviceBundlePath}: HTTP ${response.status}`);
    }
  }

  private disabledResult(confirm: boolean, targetName: string): ImportDryBundleResult {
    return {
      writeToolsEnabled: false,
      confirmed: confirm,
      dryRunSourceVerified: false,
      targetName,
      targetExists: false,
      backup: { required: false, created: false },
      import: {
        attempted: false,
        success: false,
        error:
          "Write tools are disabled. Set MOD_DWARF_ENABLE_WRITE_TOOLS=true and pass confirm=true."
      },
      localArchivePath: null,
      apiCalls: [],
      directFileWrites: false,
      notes: ["Write tools are disabled by default."]
    };
  }

  private unconfirmedResult(targetName: string): ImportDryBundleResult {
    return {
      writeToolsEnabled: true,
      confirmed: false,
      dryRunSourceVerified: false,
      targetName,
      targetExists: false,
      backup: { required: false, created: false },
      import: { attempted: false, success: false, error: "Tool input must include confirm=true." },
      localArchivePath: null,
      apiCalls: [],
      directFileWrites: false,
      notes: ["Explicit confirmation is required for this write-capable tool."]
    };
  }

  private async verifyGeneratedDryBundle(
    bundle: DryPedalboardBundle
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (bundle.dryRun !== true) return { ok: false, error: "dryBundle.dryRun must be true" };
    if (!bundle.validation.dryRun.localOnly || bundle.validation.dryRun.uploadedToDevice) {
      return { ok: false, error: "dry bundle validation does not prove local-only generation" };
    }
    if (
      !bundle.validation.pluginUris.valid ||
      !bundle.validation.snapshots.valid ||
      !bundle.validation.ttl.valid
    ) {
      return { ok: false, error: "dry bundle validation must be fully valid before import" };
    }
    if (!bundle.directoryPath.includes("mod-dwarf-mcp-")) {
      return { ok: false, error: "dry bundle must come from a mod-dwarf-mcp temporary directory" };
    }
    if (!bundle.bundlePath.startsWith(bundle.directoryPath)) {
      return { ok: false, error: "bundlePath must be inside directoryPath" };
    }

    for (const file of Object.values(bundle.generatedFiles)) {
      if (!file.startsWith(bundle.bundlePath))
        return { ok: false, error: `generated file is outside bundlePath: ${file}` };
      try {
        const info = await stat(file);
        if (!info.isFile()) return { ok: false, error: `generated path is not a file: ${file}` };
      } catch {
        return { ok: false, error: `generated file does not exist: ${file}` };
      }
    }

    return { ok: true };
  }

  private async findExistingTarget(targetName: string): Promise<PedalboardSummary | null> {
    const pedalboards = await this.pedalboardService.listPedalboards("user");
    const normalizedTarget = normalizeName(targetName);
    return (
      pedalboards.user.find(
        (pedalboard) =>
          normalizeName(pedalboard.title ?? basename(pedalboard.bundlePath)) === normalizedTarget
      ) ?? null
    );
  }

  private async createBackup(
    existing: PedalboardSummary,
    directoryPath: string,
    targetName: string
  ) {
    const backupPath = join(directoryPath, `${safeFileName(targetName)}-backup.zip`);
    const exportPaths = [
      `/pedalboard/pack_bundle/?bundlepath=${encodeURIComponent(existing.bundlePath)}`
    ];

    let lastError = "No export endpoint attempted";
    for (const path of exportPaths) {
      try {
        const response = await this.writeApiOrThrow().getBytes(
          path,
          "backup existing pedalboard before dry-bundle import"
        );
        if (response.ok) {
          await writeFile(backupPath, response.body);
          return { required: true as const, created: true as const, path: backupPath };
        }
        lastError = `HTTP ${response.status} from ${path}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return { required: true as const, created: false as const, error: lastError };
  }

  private async latestBackupResult(directoryPath: string, targetName: string) {
    const path = join(directoryPath, `${safeFileName(targetName)}-backup.zip`);
    return { required: true as const, created: true as const, path };
  }

  private async importArchive(archivePath: string) {
    try {
      const response = await this.writeApiOrThrow().postRawFile(
        IMPORT_ENDPOINT,
        archivePath,
        "import generated dry pedalboard bundle via MOD UI load_web"
      );
      if (response.ok)
        return { attempted: true as const, success: true as const, endpoint: IMPORT_ENDPOINT };
      return {
        attempted: true as const,
        success: false as const,
        error: `HTTP ${response.status} from ${IMPORT_ENDPOINT}`
      };
    } catch (error) {
      return {
        attempted: true as const,
        success: false as const,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async validateLoadedGraph(bundle: DryPedalboardBundle): Promise<LoadedGraphValidation> {
    const bundlePath = `/tmp/pedalboards/${basename(bundle.bundlePath)}`;
    const expectedPluginUris = bundle.sourcePlan.signalChain
      .map((plugin) => plugin.uri)
      .filter((uri): uri is string => Boolean(uri));

    try {
      const response = await this.writeApiOrThrow().getJson<{ plugins?: Array<{ uri?: string }> }>(
        `/pedalboard/info/?bundlepath=${encodeURIComponent(bundlePath)}`,
        "validate loaded graph after load_web import"
      );
      if (!response.ok || !response.value) {
        return {
          attempted: true,
          success: false,
          bundlePath,
          pluginCount: 0,
          expectedPluginUris,
          actualPluginUris: [],
          missingPluginUris: expectedPluginUris,
          error: `HTTP ${response.status} from /pedalboard/info/`
        };
      }

      const actualPluginUris = Array.isArray(response.value.plugins)
        ? response.value.plugins
            .map((plugin) => plugin.uri)
            .filter((uri): uri is string => Boolean(uri))
        : [];
      const missingPluginUris = expectedPluginUris.filter((uri) => !actualPluginUris.includes(uri));
      const unexpectedPluginUris = actualPluginUris.filter((uri) => !expectedPluginUris.includes(uri));
      return {
        attempted: true,
        success:
          actualPluginUris.length > 0 &&
          missingPluginUris.length === 0 &&
          unexpectedPluginUris.length === 0 &&
          actualPluginUris.length === expectedPluginUris.length,
        bundlePath,
        pluginCount: actualPluginUris.length,
        expectedPluginUris,
        actualPluginUris,
        missingPluginUris,
        unexpectedPluginUris,
        error:
          actualPluginUris.length === 0
            ? "MOD UI resolved the imported bundle as zero plugins"
            : missingPluginUris.length > 0
              ? "Loaded graph is missing expected plugin URIs"
              : unexpectedPluginUris.length > 0
                ? "Loaded graph includes unexpected plugin URIs"
              : undefined
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        bundlePath,
        pluginCount: 0,
        expectedPluginUris,
        actualPluginUris: [],
        missingPluginUris: expectedPluginUris,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  private async createTarGzArchive(bundle: DryPedalboardBundle): Promise<string> {
    const archivePath = join(bundle.directoryPath, `${basename(bundle.bundlePath)}.tar.gz`);
    const files = await Promise.all(
      Object.values(bundle.generatedFiles).map(async (file) => ({
        name: `${basename(bundle.bundlePath)}/${relative(bundle.bundlePath, file).replace(/\\/g, "/")}`,
        data: await readFile(file)
      }))
    );
    await mkdir(dirname(archivePath), { recursive: true });
    await writeFile(archivePath, makeTarGz(files));
    return archivePath;
  }

  private targetNameFromBundle(bundlePath: string): string {
    return basename(bundlePath)
      .replace(/\.pedalboard$/, "")
      .replace(/_/g, " ");
  }

  private writeApiOrThrow(): WriteHttpClient {
    if (!this.writeApi) throw new Error("Write API client is not configured");
    return this.writeApi;
  }
}

function normalizeName(value: string): string {
  return value
    .replace(/\.pedalboard$/, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pedalboard"
  );
}

function makeTarGz(files: Array<{ name: string; data: Buffer }>): Buffer {
  const records: Buffer[] = [];
  for (const file of files) {
    const header = Buffer.alloc(512, 0);
    writeTarString(header, 0, 100, file.name);
    writeTarOctal(header, 100, 8, 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, file.data.length);
    writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeTarString(header, 257, 6, "ustar");
    writeTarString(header, 263, 2, "00");
    writeTarString(header, 265, 32, "mod-dwarf-mcp");
    writeTarString(header, 297, 32, "mod-dwarf-mcp");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeTarOctal(header, 148, 8, checksum);
    records.push(header, file.data, Buffer.alloc((512 - (file.data.length % 512)) % 512, 0));
  }
  records.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(records));
}

function writeTarString(buffer: Buffer, offset: number, length: number, value: string): void {
  Buffer.from(value).copy(buffer, offset, 0, Math.min(length, Buffer.byteLength(value)));
}

function writeTarOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, "0");
  buffer.write(text.slice(0, length - 1), offset, length - 1, "ascii");
  buffer[offset + length - 1] = 0;
}
