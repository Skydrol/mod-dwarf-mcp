#!/usr/bin/env node
/**
 * Test: Shine On You Crazy Diamond (Pink Floyd) — solo tone
 * Calling create_pedalboard_from_recipe exactly as a user-facing AI would.
 *
 * Research:
 *   Gilmour's chain: Big Muff Pi fuzz → Binson Echorec tape delay → Hall reverb
 *   The solo is defined by massive sustain from the Big Muff, spacious echo from
 *   the Echorec, and the huge hall reverb that fills the space between notes.
 *   Some phrases use a flanger (Electric Mistress) but the core solo is fuzz+delay+reverb.
 *
 * Plugin mapping (from list_plugins):
 *   - "Open Big Muff" → http://moddevices.com/plugins/mod-devel/BigMuffPi
 *   - "Bollie Delay"  → https://ca9.eu/lv2/bolliedelay  (closest to Binson Echorec)
 *   - "Dragonfly Hall Reverb" → https://github.com/michaelwillis/dragonfly-reverb
 */
import { SshClient } from "../dist/clients/sshClient.js";
import { WriteHttpClient } from "../dist/clients/writeHttpClient.js";
import { PedalboardService } from "../dist/services/pedalboardService.js";
import { PluginService } from "../dist/services/pluginService.js";
import { pluginCatalog } from "../dist/data/pluginCatalog.js";
import { DryBundleService } from "../dist/services/dryBundleService.js";
import { LiveGraphAuthoringPlanService } from "../dist/services/liveGraphAuthoringPlan.js";
import { SaveLoadedPedalboardService } from "../dist/services/saveLoadedPedalboardService.js";
import { ClearCurrentPedalboardService } from "../dist/services/clearCurrentPedalboardService.js";
import { ExecutePedalboardPlanService } from "../dist/services/executePedalboardPlanService.js";
import { EffectRecipeToPedalboardPlanService } from "../dist/services/effectRecipeToPedalboardPlanService.js";
import { PluginKnowledgeDbService } from "../dist/services/pluginKnowledgeDbService.js";
import { RoleParameterProfileService } from "../dist/services/roleParameterProfileService.js";
import { PedalboardSafetyService } from "../dist/services/pedalboardSafetyService.js";

const SSH_HOST = "192.168.51.1";
const HTTP_HOST = "192.168.51.1";
const HTTP_PORT = 80;

const ssh = new SshClient({ host: SSH_HOST, username: "root", password: "mod", timeoutMs: 10000 });
const writeHttp = new WriteHttpClient({ host: HTTP_HOST, port: HTTP_PORT, timeoutMs: 15000 });
const pedalboardService = new PedalboardService(ssh);
const pluginService = new PluginService(ssh, pluginCatalog);

const recipeService = new EffectRecipeToPedalboardPlanService(
  pluginService,
  new PluginKnowledgeDbService(),
  new RoleParameterProfileService(),
  new PedalboardSafetyService()
);
const saveLoadedService = new SaveLoadedPedalboardService(pedalboardService, writeHttp, true);
const executeService = new ExecutePedalboardPlanService(
  new DryBundleService(pluginService),
  new LiveGraphAuthoringPlanService(pluginService),
  pedalboardService,
  saveLoadedService,
  new ClearCurrentPedalboardService(writeHttp, true),
  writeHttp,
  ssh
);

// ─── Recipe ───────────────────────────────────────────────────────────────────
// Built exactly as the user-facing AI would after researching the song tone
// and crossing against the installed plugin list via list_plugins.
const recipe = {
  song: "Shine On You Crazy Diamond",
  artist: "Pink Floyd",
  instrument: "guitar",
  operationMode: "new_board",

  effects: [
    {
      role: "fuzz",
      character: "Big Muff Pi — massive, creamy sustain for Gilmour's iconic crying notes",
      intensity: "strong",
      preferredPluginUri: "http://moddevices.com/plugins/mod-devel/BigMuffPi",
      preferredPluginName: "Open Big Muff"
    },
    {
      role: "delay",
      character: "Binson Echorec style — long, warm, slightly washed-out tape echo repeats",
      intensity: "medium",
      preferredPluginUri: "https://ca9.eu/lv2/bolliedelay",
      preferredPluginName: "Bollie Delay"
    },
    {
      role: "reverb",
      character: "Dragonfly Hall Reverb — vast, open, infinite-feeling Pink Floyd hall space",
      intensity: "strong",
      preferredPluginUri: "https://github.com/michaelwillis/dragonfly-reverb",
      preferredPluginName: "Dragonfly Hall Reverb"
    }
  ],

  snapshots: [
    {
      name: "Solo",
      description: "Full Big Muff fuzz with delay and lush hall reverb — main solo tone",
      effectFocus: { fuzz: "full", delay: "medium", reverb: "full" }
    },
    {
      name: "Space",
      description: "Lighter fuzz, more reverb, less delay — atmospheric sustain between phrases",
      effectFocus: { fuzz: "medium", delay: "subtle", reverb: "full" }
    }
  ],

  sections: [
    { name: "Opening", snapshot: "Solo" },
    { name: "Middle", snapshot: "Solo" },
    { name: "Fade", snapshot: "Space" }
  ]
};

console.log("Building plan for:", recipe.artist, "—", recipe.song);
const plan = await recipeService.convert(recipe);

console.log("\nSignal chain resolved:");
for (const plugin of plan.signalChain) {
  console.log(`  ${plugin.role.padEnd(10)} → ${plugin.name} (${plugin.uri})`);
}
console.log("\nSnapshots:", plan.snapshots.map(s => s.name).join(", "));

console.log("\nExecuting...");
const result = await executeService.execute({
  plan,
  confirm: true,
  title: "Pink Floyd — Shine On You Crazy Diamond"
});

if (result.saved) {
  console.log(`\n✓ Board created: "${result.title}"`);
  for (const note of result.notes) console.log("  ·", note);
} else {
  console.error("\n✗ Failed");
  for (const note of result.notes) console.error("  ·", note);
  process.exit(1);
}
