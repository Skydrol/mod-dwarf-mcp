import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CommandRunner } from "../clients/sshClient.js";
import type {
  DeviceInventory,
  DeviceInventoryControlPort,
  DeviceInventoryPlugin
} from "../types/deviceInventory.js";
import type { PluginKnowledgeDb, PluginKnowledgeEntry } from "../types/pluginKnowledgeDb.js";
import type { RefreshDeviceInventoryResult } from "../types/refreshDeviceInventory.js";
import { lines, parseKernel, parseOsRelease, parseLv2InfoPorts } from "./parsers.js";
import { readFile, shellQuote } from "./sshUtils.js";

const INVENTORY_PATH = "data/deviceInventory.json";
const KNOWLEDGE_DB_PATH = "data/pluginKnowledgeDb.json";
const KNOWLEDGE_DB_VERSION = 1;

export class DeviceInventoryService {
  constructor(
    private readonly ssh: CommandRunner,
    private readonly inventoryPath: string = INVENTORY_PATH,
    private readonly knowledgeDbPath: string = KNOWLEDGE_DB_PATH
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
    const knowledgeEntries: PluginKnowledgeEntry[] = [];

    for (const [index, uri] of uriList.entries()) {
      const name = nameList[index] ?? uri;
      const info = await this.readPluginInfo(uri);
      const plugin = buildPluginRecord(uri, name, info, null);
      plugins.push(plugin);
      knowledgeEntries.push(buildKnowledgeEntry(plugin));
    }

    const sortedPlugins = sortPlugins(plugins);
    const sortedKnowledgeEntries = sortKnowledgeEntries(knowledgeEntries);

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

    const knowledgeDb: PluginKnowledgeDb = {
      generatedAt: inventory.generatedAt,
      version: KNOWLEDGE_DB_VERSION,
      plugins: sortedKnowledgeEntries
    };

    await writeJson(this.inventoryPath, inventory);
    await writeJson(this.knowledgeDbPath, knowledgeDb);

    return {
      pluginCount: sortedPlugins.length,
      newInventoryWritten: true,
      inventoryPath: this.inventoryPath,
      knowledgeDbPath: this.knowledgeDbPath,
      knowledgeDbWritten: true
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

function writeJson(path: string, value: unknown): Promise<void> {
  const absolutePath = resolve(process.cwd(), path);
  return mkdir(dirname(absolutePath), { recursive: true }).then(() =>
    writeFile(absolutePath, JSON.stringify(value, null, 2) + "\n", "utf8")
  );
}

function sortPlugins(plugins: DeviceInventoryPlugin[]): DeviceInventoryPlugin[] {
  return [...plugins].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.uri.localeCompare(right.uri);
  });
}

function sortKnowledgeEntries(entries: PluginKnowledgeEntry[]): PluginKnowledgeEntry[] {
  return [...entries].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.uri.localeCompare(right.uri);
  });
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
      unit: port.unit ?? null,
      direction: port.direction as "input" | "output" | "unknown"
    }));

  return { uri, name, category, audioInputs, audioOutputs, controlPorts };
}

function buildKnowledgeEntry(plugin: DeviceInventoryPlugin): PluginKnowledgeEntry {
  const role = inferRole(plugin);
  const summary = buildSummary(plugin, role);
  const warnings = buildWarnings(plugin, role);
  const goodFor = buildGoodFor(role, plugin);
  const parameterMeanings = plugin.controlPorts.map((port) => ({
    symbol: port.symbol,
    meaning: describeParameter(port.symbol, port.name)
  }));
  const safeRanges = plugin.controlPorts
    .filter((port) => typeof port.minimum === "number" && typeof port.maximum === "number")
    .map((port) => ({
      symbol: port.symbol,
      min: port.minimum as number,
      max: port.maximum as number
    }));

  return {
    uri: plugin.uri,
    name: plugin.name,
    category: plugin.category ?? role,
    summary,
    roles: [role],
    goodFor,
    warnings,
    parameterMeanings,
    safeRanges,
    knownLimitations: buildLimitations(plugin, role),
    plannerNotes: buildPlannerNotes(plugin, role)
  };
}

function inferRole(plugin: DeviceInventoryPlugin): string {
  const name = plugin.name.toLowerCase();
  if (containsAny(name, ["reverb", "verb", "room", "hall", "plate", "ambience", "shimmer"]))
    return "reverb";
  if (containsAny(name, ["delay", "echo", "slap", "tape"])) return "delay";
  if (containsAny(name, ["drive", "dist", "fuzz", "muff", "overdrive", "boost", "saturator"]))
    return "drive";
  if (containsAny(name, ["compress", "limiter", "gate", "dynamics"])) return "dynamics";
  if (containsAny(name, ["eq", "filter", "lowpass", "highpass", "crossover", "parametric"]))
    return "EQ";
  if (containsAny(name, ["chorus", "phaser", "flanger", "tremolo", "mod", "vibrato", "rotary"]))
    return "modulation";
  if (containsAny(name, ["amp", "cab", "cabinet", "ir", "sim", "modeler", "preamp"])) return "amp";
  if (containsAny(name, ["gain", "volume", "fader", "atten", "mute"])) return "utility";
  return plugin.audioInputs > 0 || plugin.audioOutputs > 0 ? "utility" : "utility";
}

function buildSummary(
  plugin: DeviceInventoryPlugin,
  role: string
): PluginKnowledgeEntry["summary"] {
  switch (role) {
    case "reverb":
      return {
        purpose: `${plugin.name} adds spatial depth and decay to the signal.`,
        useWhen: "Use it when you need ambience, room size, or sustained tails.",
        differsFrom:
          "It is a reverb-type effect, so it differs from delay by smearing reflections instead of repeating discrete echoes."
      };
    case "delay":
      return {
        purpose: `${plugin.name} repeats the input signal over time.`,
        useWhen: "Use it for echo, rhythmic patterns, width, or slapback effects.",
        differsFrom:
          "It is delay-oriented, so it differs from reverb by producing audible repeats rather than dense decays."
      };
    case "drive":
      return {
        purpose: `${plugin.name} adds saturation, clipping, or harmonic distortion.`,
        useWhen: "Use it when you want more bite, sustain, or breakup.",
        differsFrom:
          "It is more aggressive than utility gain and usually colors the tone instead of only changing level."
      };
    case "dynamics":
      return {
        purpose: `${plugin.name} controls level dynamics such as compression or gating.`,
        useWhen: "Use it to smooth transients, increase consistency, or suppress noise.",
        differsFrom: "It changes the envelope of the signal rather than its tone or space."
      };
    case "EQ":
      return {
        purpose: `${plugin.name} shapes frequency balance and filtering.`,
        useWhen: "Use it to clean up muddiness, brighten a tone, or carve space in a chain.",
        differsFrom: "It targets spectrum balance rather than gain, ambience, or modulation."
      };
    case "modulation":
      return {
        purpose: `${plugin.name} adds motion, phase movement, or time-varying color.`,
        useWhen: "Use it when a tone needs movement, shimmer, or animated width.",
        differsFrom:
          "It creates movement instead of static tone shaping, and is usually subtler than distortion."
      };
    case "amp":
      return {
        purpose: `${plugin.name} emulates amplifier or cabinet behavior.`,
        useWhen: "Use it for main amp tone, speaker coloration, or IR-style cabinet shaping.",
        differsFrom: "It is a core tone-shaping stage, not just a post effect."
      };
    default:
      return {
        purpose: `${plugin.name} is a utility effect for level or routing control.`,
        useWhen: "Use it for gain staging, balancing, or simple control tasks.",
        differsFrom:
          "It is not primarily a character effect; it is there to support the rest of the chain."
      };
  }
}

function buildGoodFor(role: string, plugin: DeviceInventoryPlugin): string[] {
  switch (role) {
    case "reverb":
      return ["ambient", "shoegaze", "pads", "lead spacious"];
    case "delay":
      return ["delay lines", "U2 delay", "rhythmic textures", "ambient"];
    case "drive":
      return ["punk", "grunge", "rock", "edge"];
    case "dynamics":
      return ["clean tones", "noise control", "leveling", "punch"];
    case "EQ":
      return ["tone shaping", "cleanup", "surgical filtering"];
    case "modulation":
      return ["movement", "width", "textural color", "Tame Impala modulation"];
    case "amp":
      return ["amp tones", "cab emulation", "direct guitar rigs"];
    default:
      return plugin.audioInputs > 0 ? ["general purpose", "utility", "gain staging"] : ["utility"];
  }
}

function buildWarnings(plugin: DeviceInventoryPlugin, role: string): string[] {
  const warnings: string[] = [];
  if (role === "reverb") warnings.push("Can wash out the mix if the wet level is too high.");
  if (role === "delay") warnings.push("Feedback can build up quickly if pushed too far.");
  if (role === "drive") warnings.push("Can become noisy or harsh at high gain.");
  if (role === "modulation") warnings.push("May become too obvious if depth or rate is excessive.");
  if (plugin.audioInputs !== plugin.audioOutputs) warnings.push("Channel layout is not symmetric.");
  if (plugin.controlPorts.some((port) => port.maximum !== null && port.maximum > 1000))
    warnings.push("Some parameter ranges are very wide; start conservatively.");
  return warnings.length > 0 ? warnings : ["Use conservatively until heard in context."];
}

function buildLimitations(plugin: DeviceInventoryPlugin, role: string): string[] {
  const limitations: string[] = [];
  if (plugin.audioInputs === 0 || plugin.audioOutputs === 0)
    limitations.push("No full audio pass-through.");
  if (plugin.audioInputs === 1 && plugin.audioOutputs === 1) limitations.push("Mono in/out.");
  if (role === "reverb" || role === "delay")
    limitations.push("Can obscure dry articulation if overused.");
  return limitations;
}

function buildPlannerNotes(plugin: DeviceInventoryPlugin, role: string): string[] {
  const notes: string[] = [];
  notes.push(`${plugin.name} is best evaluated in a full signal chain, not in isolation.`);
  notes.push(`Use it as a ${role} candidate when the user asks for a ${role}-forward sound.`);
  return notes;
}

function describeParameter(symbol: string, name: string | null): string {
  const label = name ?? symbol;
  const key = `${symbol} ${label}`.toLowerCase();
  if (containsAny(key, ["mix", "wet", "blend", "dry"]))
    return "Balances dry signal against processed signal.";
  if (containsAny(key, ["gain", "level", "volume", "output", "input"]))
    return "Adjusts signal level or drive amount.";
  if (containsAny(key, ["feedback", "fb"]))
    return "Controls how much of the output is fed back into the effect.";
  if (containsAny(key, ["decay", "release", "time", "delay"]))
    return "Controls how long the effect tail or repeat lasts.";
  if (containsAny(key, ["freq", "frequency", "tone", "cut", "high", "low", "filter"]))
    return "Shapes frequency balance or filtering.";
  if (containsAny(key, ["depth", "width", "spread"]))
    return "Controls the intensity or stereo spread of the motion.";
  if (containsAny(key, ["rate", "speed", "tempo"]))
    return "Controls the modulation or repeat timing.";
  if (containsAny(key, ["enable", "bypass", "on", "off"]))
    return "Turns the processing stage on or off.";
  return `Controls the ${label.toLowerCase()} parameter.`;
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
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
