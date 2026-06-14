import type { Bank } from "../types/bank.js";
import type { PedalboardSummary } from "../types/pedalboard.js";
import type { SnapshotSummary, SnapshotValue } from "../types/snapshot.js";
import type { PluginPort, PluginPortInfo } from "../types/plugin.js";

export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseOsRelease(text: string): { name: string | null; version: string | null } {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values.set(match[1], match[2].replace(/^"|"$/g, ""));
  }
  return {
    name: values.get("NAME") ?? values.get("PRETTY_NAME") ?? null,
    version: values.get("VERSION") ?? values.get("VERSION_ID") ?? null
  };
}

export function parseKernel(uname: string): { kernel: string; architecture: string | null } {
  const parts = uname.trim().split(/\s+/);
  return {
    kernel: parts.slice(0, 3).join(" ") || uname.trim(),
    architecture: parts.length > 0 ? (parts[parts.length - 2] ?? null) : null
  };
}

export function parsePedalboardSummaries(
  text: string,
  source: "user" | "factory"
): PedalboardSummary[] {
  return lines(text).map((line) => {
    const [bundlePath, manifest, snapshots, presets, addressings] = line.split("\t");
    const basename = bundlePath.split("/").pop() ?? bundlePath;
    return {
      title: basename.replace(/\.pedalboard$/, "").replace(/_/g, " "),
      bundlePath,
      source,
      hasManifest: manifest === "1",
      hasSnapshots: snapshots === "1",
      hasPresets: presets === "1",
      hasAddressings: addressings === "1"
    };
  });
}

export function parseBanks(text: string): Bank[] {
  const value = JSON.parse(text) as unknown;
  if (!Array.isArray(value)) return [];
  return value.map((bank) => {
    const record = bank as Record<string, unknown>;
    const pedalboards = Array.isArray(record.pedalboards) ? record.pedalboards : [];
    return {
      title: String(record.title ?? ""),
      pedalboards: pedalboards.map((pedalboard) => {
        const item = pedalboard as Record<string, unknown>;
        return {
          title: String(item.title ?? ""),
          bundle: String(item.bundle ?? "")
        };
      })
    };
  });
}

export function extractMainTtlFromManifest(manifest: string): string | null {
  const match = manifest.match(/rdfs:seeAlso\s+<([^>]+)>/);
  return match?.[1] ?? null;
}

export function extractPluginsUsed(ttl: string): Array<{ instance: string; uri: string }> {
  const stanzaRegex = /^<([^>]+)>\n([\s\S]*?)(?=\n<|\n_:|\n$)/gm;
  const plugins: Array<{ instance: string; uri: string }> = [];
  for (const match of ttl.matchAll(stanzaRegex)) {
    const subject = match[1];
    const body = match[2];
    const prototype = body.match(/lv2:prototype\s+<([^>]+)>/)?.[1];
    if (prototype && /a\s+ingen:Block\b/.test(body))
      plugins.push({ instance: subject, uri: prototype });
  }
  return plugins;
}

export function extractConnections(ttl: string): Array<{ tail: string; head: string }> {
  const connectionRegex = /ingen:tail\s+<([^>]+)>\s*;\s*ingen:head\s+<([^>]+)>/g;
  return [...ttl.matchAll(connectionRegex)].map((match) => ({ tail: match[1], head: match[2] }));
}

export function extractDoapName(ttl: string): string | null {
  const match = ttl.match(/doap:name\s+"([^"]+)"/);
  return match?.[1] ?? null;
}

export function parseLv2InfoPorts(text: string, uri: string): PluginPortInfo {
  const ports: PluginPort[] = [];
  const portRegex = /Port\s+(\d+):([\s\S]*?)(?=\n\s*Port\s+\d+:|\n*$)/g;
  for (const match of text.matchAll(portRegex)) {
    const index = Number(match[1]);
    const block = match[2];
    const symbol = block.match(/Symbol:\s+([^\n]+)/)?.[1]?.trim();
    if (!symbol) continue;
    const name = block.match(/Name:\s+([^\n]+)/)?.[1]?.trim() ?? null;
    const types = [...block.matchAll(/https?:\/\/[^\s]+#[A-Za-z0-9_]+/g)].map((item) => item[0]);
    const kind = types.some((type) => type.endsWith("#AudioPort"))
      ? "audio"
      : types.some((type) => type.endsWith("#ControlPort"))
        ? "control"
        : types.some((type) => type.endsWith("#AtomPort"))
          ? "atom"
          : "other";
    const direction = types.some((type) => type.endsWith("#InputPort"))
      ? "input"
      : types.some((type) => type.endsWith("#OutputPort"))
        ? "output"
        : "unknown";

    const minimumMatch = block.match(/Minimum:\s+([^\n]+)/);
    const maximumMatch = block.match(/Maximum:\s+([^\n]+)/);
    const defaultMatch = block.match(/Default:\s+([^\n]+)/);
    const unitMatch = block.match(/Unit:\s+([^\n]+)/);
    const propertiesMatch = block.match(/Properties?:\s*([\s\S]*?)(?=\n\s*[A-Z][A-Za-z ]+:|\n*$)/);
    const properties = propertiesMatch
      ? [...propertiesMatch[1].matchAll(/https?:\/\/[^\s>]+#[A-Za-z0-9_-]+/g)].map(
          (item) => item[0]
        )
      : [];

    ports.push({
      index,
      symbol,
      name,
      types,
      kind,
      direction,
      minimum: minimumMatch ? Number(minimumMatch[1]) : undefined,
      maximum: maximumMatch ? Number(maximumMatch[1]) : undefined,
      default: defaultMatch ? Number(defaultMatch[1]) : undefined,
      unit: unitMatch ? unitMatch[1].trim() : undefined,
      properties
    });
  }

  return {
    uri,
    ports,
    audioInputs: ports.filter((port) => port.kind === "audio" && port.direction === "input"),
    audioOutputs: ports.filter((port) => port.kind === "audio" && port.direction === "output"),
    controlInputs: ports.filter((port) => port.kind === "control" && port.direction === "input")
  };
}

export function normalizeSnapshots(raw: unknown): {
  current?: number;
  snapshots: SnapshotSummary[];
} {
  const snapshotEntries = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { snapshots?: unknown }).snapshots)
      ? (raw as { snapshots: unknown[] }).snapshots
      : [];
  const current = !Array.isArray(raw) ? (raw as { current?: number }).current : undefined;

  return {
    current,
    snapshots: snapshotEntries.map((entry, index) => {
      const record = entry as Record<string, unknown>;
      const data = (record.data ?? {}) as Record<string, unknown>;
      const plugins = Object.keys(data);
      const portsByPlugin: Record<string, Record<string, SnapshotValue>> = {};
      const parametersByPlugin: Record<string, Record<string, unknown>> = {};

      for (const plugin of plugins) {
        const pluginData = data[plugin] as Record<string, unknown>;
        portsByPlugin[plugin] = normalizePorts(pluginData.ports);
        parametersByPlugin[plugin] = isRecord(pluginData.parameters) ? pluginData.parameters : {};
      }

      return {
        name: String(record.name ?? `Snapshot ${index + 1}`),
        plugins,
        portsByPlugin,
        parametersByPlugin
      };
    })
  };
}

function normalizePorts(value: unknown): Record<string, SnapshotValue> {
  if (!isRecord(value)) return {};
  const output: Record<string, SnapshotValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    output[key] =
      typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean" || raw === null
        ? raw
        : String(raw);
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
