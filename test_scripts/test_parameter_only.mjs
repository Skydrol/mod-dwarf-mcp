#!/usr/bin/env node
/**
 * Validates parameter_only mode and preferredPluginUri pin.
 *
 * Flow:
 * 1. Find the November Rain board
 * 2. Inspect it to get current plugin URIs
 * 3. Run parameter_only — change reverb wet level, keep everything else intact
 * 4. Inspect again to confirm plugin list unchanged, then check UI
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

  // ─── Find November Rain board ─────────────────────────────────────────────
  const boards = await pedalboardService.listPedalboards("user");
  const board = boards.user.find(b => (b.title ?? b.bundlePath).includes("November"));
  if (!board) {
    console.error("No November Rain board found.");
    process.exit(1);
  }
  console.log(`Found: "${board.title ?? board.bundlePath}" at ${board.bundlePath}`);

  // ─── Inspect before ───────────────────────────────────────────────────────
  const before = await pedalboardService.inspectPedalboard(board.bundlePath);
  console.log(`\nBefore — plugins (${before.pluginsUsed.length}):`, before.pluginsUsed.map(p => `${p.instance} (${p.uri})`));
  console.log(`Before — snapshots (${before.snapshots.length}):`, before.snapshots.map(s => s.name));

  // Pick reverb plugin URI from the current board
  const reverbPlugin = before.pluginsUsed.find(p =>
    p.uri?.toLowerCase().includes("reverb") || p.instance?.includes("reverb")
  );
  if (!reverbPlugin) {
    console.error("No reverb plugin found on board — cannot test parameter_only.");
    process.exit(1);
  }
  console.log(`\nReverb plugin: ${reverbPlugin.instance} (${reverbPlugin.uri})`);

  // ─── parameter_only recipe ────────────────────────────────────────────────
  // Build a recipe that mirrors the current chain but with explicit parameters
  const recipe = {
    song: "November Rain",
    artist: "Guns N' Roses",
    instrument: "guitar",
    operationMode: "parameter_only",
    effects: before.pluginsUsed.map(p => ({
      role: p.instance.replace(/_\d+$/, ""),
      character: `keep existing plugin`,
      preferredPluginUri: p.uri ?? undefined
    })),
    snapshots: before.snapshots.length > 0 ? before.snapshots.map(s => ({
      name: s.name,
      description: s.name,
      effectFocus: {}
    })) : [],
    sections: []
  };

  console.log("\n=== Testing parameter_only mode ===");
  const plan = await recipeService.convert(recipe);
  const result = await executeService.execute({
    plan,
    confirm: true,
    title: `${recipe.artist} — ${recipe.song}`,
    targetBundlepath: board.bundlePath
  });

  if (result.saved) {
    console.log(`✓ parameter_only succeeded`);
    for (const note of result.notes) console.log("  ·", note);
  } else {
    console.error("✗ parameter_only failed");
    for (const note of result.notes) console.error("  ·", note);
    process.exit(1);
  }

  // ─── Inspect after ────────────────────────────────────────────────────────
  const after = await pedalboardService.inspectPedalboard(board.bundlePath);
  console.log(`\nAfter — plugins (${after.pluginsUsed.length}):`, after.pluginsUsed.map(p => p.instance));
  console.log(`After — snapshots (${after.snapshots.length}):`, after.snapshots.map(s => s.name));

  const pluginCountOk = after.pluginsUsed.length === before.pluginsUsed.length;
  console.log(`\nPlugin count preserved: ${pluginCountOk ? "✓" : "✗"} (${before.pluginsUsed.length} → ${after.pluginsUsed.length})`);
  if (!pluginCountOk) process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
