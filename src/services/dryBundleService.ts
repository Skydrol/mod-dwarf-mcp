import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { DryBundleValidationReport, DryPedalboardBundle } from "../types/dryBundle.js";
import type { PedalboardPlan, PlannedPlugin, PlannedSnapshot } from "../types/plan.js";
import type { PluginPort, PluginPortInfo } from "../types/plugin.js";
import {
  extractConnections,
  extractDoapName,
  extractMainTtlFromManifest,
  extractPluginsUsed
} from "./parsers.js";
import type { PluginService } from "./pluginService.js";

interface ResolvedPlugin {
  plan: PlannedPlugin;
  ports: PluginPortInfo;
  controlRanges: Array<{
    requestedKey: string;
    symbol: string;
    range: { min: number; max: number; unit?: string };
  }>;
}

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
    const resolvedPlugins = await this.resolvePlugins(plan.signalChain);

    this.checkSafety(plan, resolvedPlugins);

    const title = this.titleFromPlan(plan);
    const mainFileName = `${slug(title)}.ttl`;
    const root = await mkdtemp(join(tmpdir(), "mod-dwarf-mcp-"));
    const bundlePath = join(root, `${slug(title)}.pedalboard`);
    await mkdir(bundlePath, { recursive: true });

    const manifest = this.renderManifest(mainFileName);
    const mainTtl = this.renderMainTtl(title, resolvedPlugins);
    const snapshots = this.renderSnapshots(resolvedPlugins, plan.snapshots);
    const addressings = this.renderAddressings(resolvedPlugins);

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
      validation: this.validate({
        plan,
        resolvedPlugins,
        availableUris,
        manifest,
        mainTtl,
        snapshots
      })
    };
  }

  private async installedPluginUris(): Promise<Set<string>> {
    const pluginList = await this.pluginService.listPlugins("uris");
    return new Set(
      pluginList.plugins.map((plugin) => plugin.uri).filter((uri): uri is string => Boolean(uri))
    );
  }

  private async resolvePlugins(signalChain: PlannedPlugin[]): Promise<ResolvedPlugin[]> {
    return Promise.all(
      signalChain.map(async (plan) => {
        const ports = plan.uri
          ? await this.pluginService.getPluginPorts(plan.uri)
          : { uri: "", ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
        return { plan, ports, controlRanges: resolveControlRanges(plan, ports) };
      })
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

  private renderMainTtl(title: string, signalChain: ResolvedPlugin[]): string {
    const prefixes = [
      "@prefix atom:  <http://lv2plug.in/ns/ext/atom#> .",
      "@prefix doap:  <http://usefulinc.com/ns/doap#> .",
      "@prefix ingen: <http://drobilla.net/ns/ingen#> .",
      "@prefix lv2:   <http://lv2plug.in/ns/lv2core#> .",
      "@prefix midi:  <http://lv2plug.in/ns/ext/midi#> .",
      "@prefix pedal: <http://moddevices.com/ns/modpedal#> .",
      "@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .",
      "",
      ""
    ].join("\n");

    const { ttl: connectionsTtl, arcs } = this.renderConnectionsData(signalChain);
    const blocksTtl = signalChain
      .map((plugin, index) => this.renderPluginBlock(plugin, index))
      .join("\n");

    const blockRefs =
      signalChain.length > 0
        ? signalChain.map((p) => `<${safeInstance(p.plan)}>`).join(" ,\n                ")
        : "";
    const arcRefs = arcs.length > 0 ? arcs.join(" ,\n              ") : "";

    const standardPorts = [
      "<:bpb>",
      "<:bpm>",
      "<:rolling>",
      "<midi_separated_mode>",
      "<midi_loopback>",
      "<control_in>",
      "<control_out>",
      "<serial_midi_in>",
      "<serial_midi_out>",
      "<capture_1>",
      "<capture_2>",
      "<playback_1>",
      "<playback_2>"
    ];

    const mainStanza = [
      "<>",
      `    doap:name "${escapeTtlString(title)}" ;`,
      '    pedal:unitName "MOD Dwarf" ;',
      '    pedal:unitModel "dwarf:aarch64-a35" ;',
      ...(arcs.length > 0 ? [`    ingen:arc ${arcRefs} ;`] : []),
      ...(signalChain.length > 0 ? [`    ingen:block ${blockRefs} ;`] : []),
      `    lv2:port ${standardPorts.join(" ,\n             ")} ;`,
      "    a lv2:Plugin ,",
      "        ingen:Graph ,",
      "        pedal:Pedalboard ."
    ].join("\n");

    const standardPortDefinitions = this.renderStandardPortDefinitions();

    return `${prefixes}${connectionsTtl}${blocksTtl}${mainStanza}\n\n${standardPortDefinitions}\n`;
  }

  private renderConnectionsData(signalChain: ResolvedPlugin[]): { ttl: string; arcs: string[] } {
    const connections: string[] = [];
    const arcs: string[] = [];
    let arcCount = 1;

    const add = (tail: string, head: string) => {
      const id = `_:b${arcCount}`;
      connections.push([id, `    ingen:tail <${tail}> ;`, `    ingen:head <${head}> .`].join("\n"));
      arcs.push(id);
      arcCount += 1;
    };

    if (signalChain.length === 0) {
      add("capture_1", "playback_1");
    } else {
      for (const [tail, head] of pairPorts(["capture_1", "capture_2"], inputRefs(signalChain[0])))
        add(tail, head);
      for (let index = 0; index < signalChain.length - 1; index += 1) {
        for (const [tail, head] of pairPorts(
          outputRefs(signalChain[index]),
          inputRefs(signalChain[index + 1])
        ))
          add(tail, head);
      }
      for (const [tail, head] of pairPorts(outputRefs(signalChain[signalChain.length - 1]), [
        "playback_1",
        "playback_2"
      ]))
        add(tail, head);
    }

    return { ttl: `${connections.join("\n\n")}\n\n`, arcs };
  }

  private renderStandardPortDefinitions(): string {
    return [
      "<capture_1>",
      "    lv2:index 5 ;",
      '    lv2:symbol "capture_1" ;',
      "    a lv2:AudioPort ,",
      "        lv2:InputPort .",
      "",
      "<capture_2>",
      "    lv2:index 6 ;",
      '    lv2:symbol "capture_2" ;',
      "    a lv2:AudioPort ,",
      "        lv2:InputPort .",
      "",
      "<playback_1>",
      "    lv2:index 7 ;",
      '    lv2:symbol "playback_1" ;',
      "    a lv2:AudioPort ,",
      "        lv2:OutputPort .",
      "",
      "<playback_2>",
      "    lv2:index 8 ;",
      '    lv2:symbol "playback_2" ;',
      "    a lv2:AudioPort ,",
      "        lv2:OutputPort .",
      "",
      "<:bpb>",
      "    ingen:value 4.0 ; a lv2:ControlPort , lv2:InputPort .",
      "<:bpm>",
      "    ingen:value 120.0 ; a lv2:ControlPort , lv2:InputPort .",
      "<:rolling>",
      "    ingen:value 0 ; a lv2:ControlPort , lv2:InputPort .",
      "<midi_separated_mode>",
      "    ingen:value 0 ; a lv2:ControlPort , lv2:InputPort .",
      "<midi_loopback>",
      "    ingen:value 0 ; a lv2:ControlPort , lv2:InputPort .",
      "<control_in>",
      '    lv2:symbol "control_in" ; a atom:AtomPort , lv2:InputPort .',
      "<control_out>",
      '    lv2:symbol "control_out" ; a atom:AtomPort , lv2:OutputPort .',
      "<serial_midi_in>",
      '    lv2:symbol "serial_midi_in" ; a atom:AtomPort , lv2:InputPort .',
      "<serial_midi_out>",
      '    lv2:symbol "serial_midi_out" ; a atom:AtomPort , lv2:OutputPort .'
    ].join("\n");
  }

  private renderConnections(signalChain: ResolvedPlugin[]): string {
    if (signalChain.length === 0) {
      return ["_:b1", "    ingen:tail <capture_1> ;", "    ingen:head <playback_1> .", "", ""].join(
        "\n"
      );
    }

    const connections: string[] = [];
    let arc = 1;
    const add = (tail: string, head: string) => {
      connections.push(
        [`_:b${arc}`, `    ingen:tail <${tail}> ;`, `    ingen:head <${head}> .`].join("\n")
      );
      arc += 1;
    };

    for (const [tail, head] of pairPorts(["capture_1", "capture_2"], inputRefs(signalChain[0])))
      add(tail, head);
    for (let index = 0; index < signalChain.length - 1; index += 1) {
      for (const [tail, head] of pairPorts(
        outputRefs(signalChain[index]),
        inputRefs(signalChain[index + 1])
      ))
        add(tail, head);
    }
    for (const [tail, head] of pairPorts(outputRefs(signalChain[signalChain.length - 1]), [
      "playback_1",
      "playback_2"
    ]))
      add(tail, head);

    return `${connections.join("\n\n")}\n\n`;
  }

  private renderPluginBlock(plugin: ResolvedPlugin, index: number): string {
    const instance = safeInstance(plugin.plan);
    const audioPorts = [...plugin.ports.audioInputs, ...plugin.ports.audioOutputs];
    const portList = [
      ...audioPorts.map((port) => `<${instance}/${port.symbol}>`),
      ...plugin.controlRanges.map((port) => `<${instance}/${port.symbol}>`),
      `<${instance}/:bypass>`
    ];
    const audioStanzas = audioPorts.map((port) => renderAudioPort(instance, port)).join("\n");
    const controls = plugin.controlRanges
      .map((port) => {
        const value = midpoint(port.range.min, port.range.max);
        return [
          `<${instance}/${port.symbol}>`,
          `    ingen:value ${formatNumber(value)} ;`,
          "    a lv2:ControlPort ,",
          "        lv2:InputPort .",
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
      `    lv2:prototype <${plugin.plan.uri ?? ""}> ;`,
      `    pedal:instanceNumber ${index} ;`,
      "    a ingen:Block .",
      "",
      audioStanzas,
      controls
    ].join("\n");
  }

  private renderSnapshots(signalChain: ResolvedPlugin[], snapshots: PlannedSnapshot[]) {
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
            safeInstance(plugin.plan),
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

  private snapshotPorts(plugin: ResolvedPlugin, snapshotIndex: number): Record<string, number> {
    return Object.fromEntries(
      plugin.controlRanges.map((port) => {
        const base = midpoint(port.range.min, port.range.max);
        const spread = (port.range.max - port.range.min) * 0.18;
        const adjusted =
          snapshotIndex === 0
            ? base
            : Math.min(port.range.max, Math.max(port.range.min, base + spread * snapshotIndex));
        return [port.symbol, Number(adjusted.toFixed(4))];
      })
    );
  }

  private renderAddressings(signalChain: ResolvedPlugin[]) {
    const entries = signalChain
      .flatMap((plugin) => {
        const firstRange = plugin.controlRanges[0];
        if (!firstRange) return [];
        return [
          {
            instance: `/graph/${safeInstance(plugin.plan)}`,
            label: plugin.plan.role,
            port: firstRange.symbol,
            minimum: firstRange.range.min,
            maximum: firstRange.range.max
          }
        ];
      })
      .slice(0, 4);
    return Object.fromEntries(entries.map((entry, index) => [`/hmi/knob${index + 1}`, [entry]]));
  }

  private checkSafety(plan: PedalboardPlan, resolvedPlugins: ResolvedPlugin[]): void {
    const errors: string[] = [];

    for (const resolved of resolvedPlugins) {
      if (resolved.ports.ports.length === 0) {
        errors.push(`Metadata missing for plugin: ${resolved.plan.uri || resolved.plan.name}`);
      }

      if (resolved.ports.audioInputs.length === 0) {
        errors.push(`Plugin has no audio inputs: ${resolved.plan.uri || resolved.plan.name}`);
      }
      if (resolved.ports.audioOutputs.length === 0) {
        errors.push(`Plugin has no audio outputs: ${resolved.plan.uri || resolved.plan.name}`);
      }

      for (const requestedKey of Object.keys(resolved.plan.parameterRanges)) {
        const port = resolved.controlRanges.find((cr) => cr.requestedKey === requestedKey);
        if (!port) {
          errors.push(
            `Parameter '${requestedKey}' not found on plugin: ${resolved.plan.uri || resolved.plan.name}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Safety check failed: \n- ${errors.join("\n- ")}`);
    }
  }

  private validate(input: {
    plan: PedalboardPlan;
    resolvedPlugins: ResolvedPlugin[];
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
    if (pluginsUsed.length !== input.plan.signalChain.length)
      errors.push("main TTL plugin block count does not match the planned signal chain");
    if (input.resolvedPlugins.some((plugin) => plugin.ports.audioInputs.length === 0))
      errors.push("one or more planned plugins has no LV2 audio input port metadata");
    if (input.resolvedPlugins.some((plugin) => plugin.ports.audioOutputs.length === 0))
      errors.push("one or more planned plugins has no LV2 audio output port metadata");
    if (input.plan.signalChain.length > 0 && connections.length < input.plan.signalChain.length + 1)
      errors.push(
        "main TTL does not contain enough graph connections for the planned signal chain"
      );
    if (!extractDoapName(input.mainTtl)) errors.push("main TTL is missing doap:name metadata");
    if (!input.mainTtl.includes("pedal:instanceNumber") || !input.mainTtl.includes("a ingen:Block"))
      errors.push("main TTL does not follow the expected MOD pedalboard block structure");

    return {
      pluginUris: { valid: missing.length === 0, checked, missing },
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

function inputRefs(plugin: ResolvedPlugin): string[] {
  const instance = safeInstance(plugin.plan);
  return plugin.ports.audioInputs.map((port) => `${instance}/${port.symbol}`);
}

function outputRefs(plugin: ResolvedPlugin): string[] {
  const instance = safeInstance(plugin.plan);
  return plugin.ports.audioOutputs.map((port) => `${instance}/${port.symbol}`);
}

function pairPorts(sources: string[], destinations: string[]): Array<[string, string]> {
  if (sources.length === 0 || destinations.length === 0) return [];
  if (sources.length === 1) return destinations.map((destination) => [sources[0], destination]);
  if (destinations.length === 1) return [[sources[0], destinations[0]]];
  return destinations.map((destination, index) => [
    sources[Math.min(index, sources.length - 1)],
    destination
  ]);
}

function renderAudioPort(instance: string, port: PluginPort): string {
  const direction = port.direction === "output" ? "lv2:OutputPort" : "lv2:InputPort";
  return [
    `<${instance}/${port.symbol}>`,
    "    a lv2:AudioPort ,",
    `        ${direction} .`,
    ""
  ].join("\n");
}

function resolveControlRanges(
  plugin: PlannedPlugin,
  ports: PluginPortInfo
): ResolvedPlugin["controlRanges"] {
  const used = new Set<string>();
  return Object.entries(plugin.parameterRanges).flatMap(([requestedKey, planRange]) => {
    const port = findControlPort(requestedKey, ports.controlInputs, used);
    if (!port) return [];
    used.add(port.symbol);

    const range = {
      min: port.minimum ?? planRange.min,
      max: port.maximum ?? planRange.max,
      unit: port.unit ?? planRange.unit
    };

    return [{ requestedKey, symbol: port.symbol, range }];
  });
}

function findControlPort(key: string, ports: PluginPort[], used: Set<string>): PluginPort | null {
  const normalizedKey = normalizePortKey(key);

  // 1. Try exact symbol match (case-insensitive)
  const exactSymbol = ports.find(
    (port) => !used.has(port.symbol) && normalizePortKey(port.symbol) === normalizedKey
  );
  if (exactSymbol) return exactSymbol;

  // 2. Try exact name match (case-insensitive)
  const exactName = ports.find(
    (port) => !used.has(port.symbol) && normalizePortKey(port.name ?? "") === normalizedKey
  );
  if (exactName) return exactName;

  // 3. Try aliases
  const aliases = CONTROL_ALIASES[normalizedKey] ?? [];
  for (const alias of aliases) {
    const normalizedAlias = normalizePortKey(alias);
    const matched = ports.find(
      (port) =>
        !used.has(port.symbol) &&
        (normalizePortKey(port.symbol) === normalizedAlias ||
          normalizePortKey(port.name ?? "") === normalizedAlias)
    );
    if (matched) return matched;
  }

  return null;
}

const CONTROL_ALIASES: Record<string, string[]> = {
  gain: ["gain", "volume", "level"],
  level: ["level", "volume", "gain"],
  mix: ["mix", "blend", "wetlevel", "wet", "earlylevel"],
  feedback: ["feedback"],
  time: ["time", "delay", "delaytime", "divl"],
  rate: ["rate", "frequency"],
  depth: ["depth"],
  threshold: ["threshold", "thr"],
  ratio: ["ratio", "rat"],
  attack: ["attack", "att"],
  release: ["release", "rel"],
  decay: ["decay"],
  lowcut: ["lowcut", "lowf"],
  highcut: ["highcut", "highf"]
};

function normalizePortKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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
