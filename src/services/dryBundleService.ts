import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { DryBundleValidationReport, DryPedalboardBundle } from "../types/dryBundle.js";
import type { PedalboardPlan, PlannedPlugin, PlannedSnapshot } from "../types/plan.js";
import {
  extractConnections,
  extractDoapName,
  extractMainTtlFromManifest,
  extractPluginsUsed
} from "./parsers.js";
import type { PluginService } from "./pluginService.js";

const snapshotsFileSchema = z
  .object({
    current: z.number().int().min(0),
    snapshots: z.array(
      z.object({
        name: z.string().min(1),
        data: z.record(
          z.object({
            preset: z.string(),
            bypassed: z.boolean(),
            parameters: z.record(z.unknown()),
            ports: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()]))
          })
        )
      })
    )
  })
  .superRefine((value, context) => {
    if (value.snapshots.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one snapshot is required"
      });
    }
    if (value.current >= value.snapshots.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "current must point to an existing snapshot"
      });
    }
  });

export class DryBundleService {
  constructor(private readonly pluginService: PluginService) {}

  async createDryBundle(plan: PedalboardPlan): Promise<DryPedalboardBundle> {
    const availableUris = await this.installedPluginUris();
    const title = this.titleFromPlan(plan);
    const mainFileName = `${slug(title)}.ttl`;
    const root = await mkdtemp(join(tmpdir(), "mod-dwarf-mcp-"));
    const bundlePath = join(root, `${slug(title)}.pedalboard`);
    await mkdir(bundlePath, { recursive: true });

    const manifest = this.renderManifest(mainFileName);
    const mainTtl = this.renderMainTtl(title, plan.signalChain);
    const snapshots = this.renderSnapshots(plan.signalChain, plan.snapshots);
    const addressings = this.renderAddressings(plan.signalChain);

    const generatedFiles = {
      manifest: join(bundlePath, "manifest.ttl"),
      mainTtl: join(bundlePath, mainFileName),
      snapshots: join(bundlePath, "snapshots.json"),
      addressings: join(bundlePath, "addressings.json")
    };

    await Promise.all([
      writeFile(generatedFiles.manifest, manifest, "utf8"),
      writeFile(generatedFiles.mainTtl, mainTtl, "utf8"),
      writeFile(generatedFiles.snapshots, `${JSON.stringify(snapshots, null, 2)}\n`, "utf8"),
      writeFile(generatedFiles.addressings, `${JSON.stringify(addressings, null, 2)}\n`, "utf8")
    ]);

    return {
      dryRun: true,
      sourcePlan: plan,
      directoryPath: root,
      bundlePath,
      generatedFiles,
      validation: this.validate({ plan, availableUris, manifest, mainTtl, snapshots })
    };
  }

  private async installedPluginUris(): Promise<Set<string>> {
    const pluginList = await this.pluginService.listPlugins("uris");
    return new Set(
      pluginList.plugins.map((plugin) => plugin.uri).filter((uri): uri is string => Boolean(uri))
    );
  }

  private renderManifest(mainFileName: string): string {
    return [
      "@prefix ingen: <http://drobilla.net/ns/ingen#> .",
      "@prefix lv2:   <http://lv2plug.in/ns/lv2core#> .",
      "@prefix pedal: <http://moddevices.com/ns/modpedal#> .",
      "@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .",
      "",
      `<${mainFileName}>`,
      "    lv2:prototype ingen:GraphPrototype ;",
      "    a lv2:Plugin ,",
      "        ingen:Graph ,",
      "        pedal:Pedalboard ;",
      `    rdfs:seeAlso <${mainFileName}> .`,
      ""
    ].join("\n");
  }

  private renderMainTtl(title: string, signalChain: PlannedPlugin[]): string {
    const prefixes = [
      "@prefix doap:  <http://usefulinc.com/ns/doap#> .",
      "@prefix ingen: <http://drobilla.net/ns/ingen#> .",
      "@prefix lv2:   <http://lv2plug.in/ns/lv2core#> .",
      "@prefix pedal: <http://moddevices.com/ns/modpedal#> .",
      "",
      ""
    ].join("\n");
    const connections = this.renderConnections(signalChain);
    const blocks = signalChain
      .map((plugin, index) => this.renderPluginBlock(plugin, index))
      .join("\n");

    return `${prefixes}${connections}${blocks}\n<>\n    doap:name "${escapeTtlString(title)}" .\n`;
  }

  private renderConnections(signalChain: PlannedPlugin[]): string {
    if (signalChain.length === 0) {
      return ["_:b1", "    ingen:tail <capture_1> ;", "    ingen:head <playback_1> .", "", ""].join(
        "\n"
      );
    }

    const connections: string[] = [];
    connections.push(
      [
        "_:b1",
        "    ingen:tail <capture_1> ;",
        `    ingen:head <${safeInstance(signalChain[0])}/In> .`
      ].join("\n")
    );

    for (let index = 0; index < signalChain.length - 1; index += 1) {
      connections.push(
        [
          `_:b${index + 2}`,
          `    ingen:tail <${safeInstance(signalChain[index])}/Out> ;`,
          `    ingen:head <${safeInstance(signalChain[index + 1])}/In> .`
        ].join("\n")
      );
    }

    connections.push(
      [
        `_:b${signalChain.length + 1}`,
        `    ingen:tail <${safeInstance(signalChain[signalChain.length - 1])}/Out> ;`,
        "    ingen:head <playback_1> ."
      ].join("\n")
    );

    return `${connections.join("\n\n")}\n\n`;
  }

  private renderPluginBlock(plugin: PlannedPlugin, index: number): string {
    const instance = safeInstance(plugin);
    const controlPorts = Object.keys(plugin.parameterRanges);
    const portList = [
      `<${instance}/In>`,
      `<${instance}/Out>`,
      ...controlPorts.map((port) => `<${instance}/${safePort(port)}>`),
      `<${instance}/:bypass>`
    ];
    const controls = controlPorts
      .map((port) => {
        const range = plugin.parameterRanges[port];
        const value = midpoint(range.min, range.max);
        return [
          `<${instance}/${safePort(port)}>`,
          `    ingen:value ${formatNumber(value)} ;`,
          "    a lv2:ControlPort , lv2:InputPort .",
          ""
        ].join("\n");
      })
      .join("\n");

    return [
      `<${instance}>`,
      `    ingen:canvasX ${100 + index * 220}.0 ;`,
      `    ingen:canvasY ${index % 2 === 0 ? "180.0" : "300.0"} ;`,
      "    ingen:enabled true ;",
      `    lv2:port ${portList.join(" , ")} ;`,
      `    lv2:prototype <${plugin.uri ?? ""}> ;`,
      `    pedal:instanceNumber ${index} ;`,
      "    a ingen:Block .",
      "",
      controls
    ].join("\n");
  }

  private renderSnapshots(signalChain: PlannedPlugin[], snapshots: PlannedSnapshot[]) {
    const safeSnapshots =
      snapshots.length > 0
        ? snapshots
        : [{ name: "Base", description: "Base dry-run snapshot", parameterFocus: {} }];
    return {
      current: 0,
      snapshots: safeSnapshots.map((snapshot, snapshotIndex) => ({
        name: snapshot.name,
        data: Object.fromEntries(
          signalChain.map((plugin) => [
            safeInstance(plugin),
            {
              preset: "",
              bypassed: false,
              parameters: {},
              ports: this.snapshotPorts(plugin, snapshotIndex)
            }
          ])
        )
      }))
    };
  }

  private snapshotPorts(plugin: PlannedPlugin, snapshotIndex: number): Record<string, number> {
    return Object.fromEntries(
      Object.entries(plugin.parameterRanges).map(([port, range]) => {
        const base = midpoint(range.min, range.max);
        const spread = (range.max - range.min) * 0.18;
        const adjusted =
          snapshotIndex === 0
            ? base
            : Math.min(range.max, Math.max(range.min, base + spread * snapshotIndex));
        return [safePort(port), Number(adjusted.toFixed(4))];
      })
    );
  }

  private renderAddressings(signalChain: PlannedPlugin[]) {
    const entries = signalChain
      .flatMap((plugin) => {
        const firstRange = Object.entries(plugin.parameterRanges)[0];
        if (!firstRange) return [];
        const [port, range] = firstRange;
        return [
          {
            instance: `/graph/${safeInstance(plugin)}`,
            label: plugin.role,
            port: safePort(port),
            minimum: range.min,
            maximum: range.max
          }
        ];
      })
      .slice(0, 4);

    return Object.fromEntries(entries.map((entry, index) => [`/hmi/knob${index + 1}`, [entry]]));
  }

  private validate(input: {
    plan: PedalboardPlan;
    availableUris: Set<string>;
    manifest: string;
    mainTtl: string;
    snapshots: unknown;
  }): DryBundleValidationReport {
    const checked = input.plan.signalChain
      .map((plugin) => plugin.uri)
      .filter((uri): uri is string => Boolean(uri));
    const missing = input.plan.signalChain.flatMap((plugin) => {
      if (!plugin.uri) return [`${plugin.name}: missing plugin URI`];
      return input.availableUris.has(plugin.uri) ? [] : [plugin.uri];
    });
    const snapshotResult = snapshotsFileSchema.safeParse(input.snapshots);
    const mainFromManifest = extractMainTtlFromManifest(input.manifest);
    const pluginsUsed = extractPluginsUsed(input.mainTtl);
    const connections = extractConnections(input.mainTtl);
    const errors: string[] = [];

    if (!mainFromManifest)
      errors.push("manifest.ttl does not reference a main TTL with rdfs:seeAlso");
    if (pluginsUsed.length !== input.plan.signalChain.length) {
      errors.push("main TTL plugin block count does not match the planned signal chain");
    }
    if (
      input.plan.signalChain.length > 0 &&
      connections.length < input.plan.signalChain.length + 1
    ) {
      errors.push(
        "main TTL does not contain enough graph connections for the planned signal chain"
      );
    }
    if (!extractDoapName(input.mainTtl)) errors.push("main TTL is missing doap:name metadata");
    if (
      !input.mainTtl.includes("pedal:instanceNumber") ||
      !input.mainTtl.includes("a ingen:Block")
    ) {
      errors.push("main TTL does not follow the expected MOD pedalboard block structure");
    }

    return {
      pluginUris: {
        valid: missing.length === 0,
        checked,
        missing
      },
      snapshots: {
        valid: snapshotResult.success,
        errors: snapshotResult.success
          ? []
          : snapshotResult.error.issues.map((issue) => issue.message),
        snapshotCount: snapshotResult.success ? snapshotResult.data.snapshots.length : 0
      },
      ttl: {
        valid: errors.length === 0,
        errors,
        manifestReferencesMainTtl: Boolean(mainFromManifest),
        mainTtlHasPedalboardName: Boolean(extractDoapName(input.mainTtl)),
        pluginBlockCount: pluginsUsed.length,
        connectionCount: connections.length,
        followsTemplateStructure:
          input.mainTtl.includes("pedal:instanceNumber") && input.mainTtl.includes("a ingen:Block")
      },
      dryRun: {
        localOnly: true,
        uploadedToDevice: false,
        calledModApi: false,
        modifiedPedalboards: false
      }
    };
  }

  private titleFromPlan(plan: PedalboardPlan): string {
    return `${plan.request.instrument} ${plan.request.style}`.trim() || "Dry Run Pedalboard";
  }
}

function midpoint(min: number, max: number): number {
  return min + (max - min) / 2;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function safeInstance(plugin: PlannedPlugin): string {
  return slug(plugin.suggestedInstance || plugin.name || plugin.role);
}

function safePort(port: string): string {
  return slug(port);
}

function slug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "pedalboard";
}

function escapeTtlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
