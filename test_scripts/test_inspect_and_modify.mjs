#!/usr/bin/env node
/**
 * Quick validation of inspect_pedalboard + modify_current_board flows.
 * Run with: node test_scripts/test_inspect_and_modify.mjs
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
const SSH_USER = "root";
const SSH_PASS = "mod";
const HTTP_HOST = "192.168.51.1";
const HTTP_PORT = 80;
const HTTP_TIMEOUT_MS = 15000;
const SSH_TIMEOUT_MS = 10000;

async function main() {
  const ssh = new SshClient({ host: SSH_HOST, username: SSH_USER, password: SSH_PASS, timeoutMs: SSH_TIMEOUT_MS });
  const writeHttp = new WriteHttpClient({ host: HTTP_HOST, port: HTTP_PORT, timeoutMs: HTTP_TIMEOUT_MS });
  const pedalboardService = new PedalboardService(ssh);
  const pluginService = new PluginService(ssh, pluginCatalog);

  // ─── Fluxo 2H: inspect_pedalboard ────────────────────────────────────────
  console.log("\n=== Fluxo 2H: inspect_pedalboard ===");
  const boards = await pedalboardService.listPedalboards("user");
  const novRain2 = boards.user.find(b =>
    (b.title ?? b.bundlePath).includes("November") && (b.title ?? b.bundlePath).includes("2")
  );
  const novRain = novRain2 ?? boards.user.find(b => (b.title ?? b.bundlePath).includes("November"));

  if (!novRain) {
    console.error("No November Rain pedalboard found.");
    console.log("Available boards:", boards.user.map(b => b.title ?? b.bundlePath));
    process.exit(1);
  }

  console.log(`Found board: "${novRain.title ?? novRain.bundlePath}"`);
  console.log(`Bundlepath: ${novRain.bundlePath}`);

  const inspection = await pedalboardService.inspectPedalboard(novRain.bundlePath);
  console.log(`Plugins (${inspection.pluginsUsed.length}):`, inspection.pluginsUsed.map(p => p.instance));
  console.log(`Snapshots (${inspection.snapshots.length}):`, inspection.snapshots.map(s => s.name));
  console.log("✓ inspect_pedalboard works\n");

  // ─── Fluxo 2I: modify_current_board ──────────────────────────────────────
  console.log("=== Fluxo 2I: modify_current_board ===");
  const modifyRecipe = {
    song: "November Rain",
    artist: "Guns N' Roses",
    instrument: "guitar",
    operationMode: "modify_current_board",
    effects: [
      { role: "overdrive", character: "GxTubeScreamer — light tube screamer", intensity: "subtle" },
      { role: "chorus", character: "TAP Chorus/Flanger — lush warm chorus", intensity: "medium" },
      { role: "reverb", character: "Dragonfly Hall Reverb — large hall reverb", intensity: "strong" },
      { role: "delay", character: "Bollie Delay — rhythmic echo", intensity: "medium" }
    ],
    snapshots: [
      { name: "Clean", description: "Chorus + reverb — intro tone", effectFocus: { overdrive: "none", chorus: "full", reverb: "full", delay: "none" } },
      { name: "Solo", description: "Tube screamer + delay — solo tone", effectFocus: { overdrive: "full", chorus: "none", reverb: "medium", delay: "full" } }
    ],
    sections: []
  };

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

  const plan = await recipeService.convert(modifyRecipe);
  const result = await executeService.execute({
    plan,
    confirm: true,
    title: `${modifyRecipe.artist} — ${modifyRecipe.song}`,
    targetBundlepath: novRain.bundlePath
  });

  if (result.saved) {
    console.log(`✓ modify_current_board succeeded: "${result.title}"`);
    for (const note of result.notes) console.log("  ·", note);
  } else {
    console.error("✗ modify_current_board failed.");
    for (const note of result.notes) console.error("  ·", note);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
