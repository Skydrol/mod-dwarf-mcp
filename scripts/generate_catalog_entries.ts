/**
 * Fetches lv2info for a list of plugin URIs via SSH and prints TypeScript
 * catalog entries ready to paste into src/data/pluginCatalog.ts.
 */
import { createClients } from "../src/clients/modDwarfClient.js";
import { loadEnv } from "../src/schemas/env.js";
import { parseLv2InfoPorts } from "../src/services/parsers.js";
import { shellQuote } from "../src/services/sshUtils.js";

const PLUGINS_TO_ADD: Array<{ name: string; uri: string }> = [
  // Distortion / Drive
  { name: "DS1",             uri: "http://moddevices.com/plugins/mod-devel/DS1" },
  { name: "GxSD1",           uri: "http://guitarix.sourceforge.net/plugins/gx_sd1sim_#_sd1sim_" },
  { name: "GxTubeScreamer",  uri: "http://guitarix.sourceforge.net/plugins/gxts9#ts9sim" },
  { name: "ChowCentaur",     uri: "https://github.com/jatinchowdhury18/KlonCentaur" },
  { name: "Open Big Muff",   uri: "http://moddevices.com/plugins/mod-devel/BigMuffPi" },
  { name: "CollisionDrive",  uri: "https://github.com/brummer10/CollisionDrive" },
  { name: "MetalTone",       uri: "https://github.com/brummer10/MetalTone" },
  { name: "GxBooster",       uri: "http://guitarix.sourceforge.net/plugins/gxbooster#booster" },
  // Modulation / Delay / Reverb
  { name: "Modulay",         uri: "https://github.com/ninodewit/SHIRO-Plugins/plugins/modulay" },
  { name: "Shiroverb",       uri: "https://github.com/ninodewit/SHIRO-Plugins/plugins/shiroverb" },
  { name: "MDA DubDelay",    uri: "http://moddevices.com/plugins/mda/DubDelay" },
  { name: "TAP Stereo Echo", uri: "http://moddevices.com/plugins/tap/echo" },
  { name: "Ping Pong Pan",   uri: "http://distrho.sf.net/plugins/PingPongPan" },
  { name: "TAL-Reverb-II",   uri: "http://moddevices.com/plugins/tal-reverb-2" },
  { name: "Dragonfly Room Reverb",  uri: "urn:dragonfly:room" },
  { name: "Dragonfly Plate Reverb", uri: "urn:dragonfly:plate" },
  // Utility / Guitar
  { name: "GxCompressor",    uri: "http://guitarix.sourceforge.net/plugins/gx_compressor#_compressor" },
  { name: "Noise Gate",      uri: "http://moddevices.com/plugins/mod-devel/System-NoiseGate" },
  { name: "Volume",          uri: "http://moddevices.com/plugins/mod-devel/mod-volume" },
  { name: "GxTuner",        uri: "urn:mod:gxtuner" },
  { name: "Autotune",        uri: "http://gareus.org/oss/lv2/fat1" },
  { name: "TAP Tubewarmth",  uri: "http://moddevices.com/plugins/tap/tubewarmth" },
  { name: "TAP Sigmoid Booster", uri: "http://moddevices.com/plugins/tap/sigmoid" },
];

const config = loadEnv();
const clients = createClients(config);

function renderPort(port: {
  index: number;
  symbol: string;
  name: string;
  types: string[];
  kind: string;
  direction: string;
  minimum: number;
  maximum: number;
  default: number;
  properties: string[];
}): string {
  return [
    "      {",
    `        index: ${port.index},`,
    `        symbol: ${JSON.stringify(port.symbol)},`,
    `        name: ${JSON.stringify(port.name)},`,
    `        types: ${JSON.stringify(port.types)},`,
    `        kind: ${JSON.stringify(port.kind)},`,
    `        direction: ${JSON.stringify(port.direction)},`,
    `        minimum: ${port.minimum},`,
    `        maximum: ${port.maximum},`,
    `        default: ${port.default},`,
    `        properties: ${JSON.stringify(port.properties)}`,
    "      }"
  ].join("\n");
}

const results: string[] = [];
const failures: string[] = [];

for (const plugin of PLUGINS_TO_ADD) {
  process.stderr.write(`Fetching: ${plugin.name}...`);
  try {
    const result = await clients.ssh.exec(`lv2info ${shellQuote(plugin.uri)}`);
    if (result.code !== 0 || !result.stdout.trim()) {
      failures.push(`${plugin.name}: lv2info returned code ${result.code}`);
      process.stderr.write(" FAILED\n");
      continue;
    }
    const info = parseLv2InfoPorts(result.stdout, plugin.uri);
    if (info.ports.length === 0) {
      failures.push(`${plugin.name}: no ports parsed`);
      process.stderr.write(" no ports\n");
      continue;
    }
    const entry = [
      "  {",
      `    uri: ${JSON.stringify(plugin.uri)},`,
      `    name: ${JSON.stringify(plugin.name)},`,
      "    ports: [",
      info.ports.map(renderPort).join(",\n"),
      "    ]",
      "  }"
    ].join("\n");
    results.push(entry);
    process.stderr.write(` OK (${info.audioInputs.length}in/${info.audioOutputs.length}out, ${info.controlInputs.length} ctrl)\n`);
  } catch (err) {
    failures.push(`${plugin.name}: ${String(err)}`);
    process.stderr.write(" ERROR\n");
  }
}

// Print results to stdout
console.log("// ---- paste these entries into pluginCatalog.ts ----");
console.log(results.join(",\n"));

if (failures.length > 0) {
  process.stderr.write("\nFailed:\n");
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
}
