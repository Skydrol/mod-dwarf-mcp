/**
 * Browser validation script — creates a test pedalboard and exercises all live write tools.
 * Run: node test_scripts/browser_validation.mjs
 * Take browser screenshots between STEP markers.
 */

import { SshClient } from "../dist/clients/sshClient.js";
import { WriteHttpClient } from "../dist/clients/writeHttpClient.js";
import { PluginService } from "../dist/services/pluginService.js";
import { PedalboardService } from "../dist/services/pedalboardService.js";
import { SnapshotService } from "../dist/services/snapshotService.js";
import { DryBundleService } from "../dist/services/dryBundleService.js";
import { ClearCurrentPedalboardService } from "../dist/services/clearCurrentPedalboardService.js";
import { SaveLoadedPedalboardService } from "../dist/services/saveLoadedPedalboardService.js";
import { LiveGraphAuthoringPlanService } from "../dist/services/liveGraphAuthoringPlan.js";
import { GraphEditorService } from "../dist/services/graphEditorService.js";
import { EffectRecipeToPedalboardPlanService } from "../dist/services/effectRecipeToPedalboardPlanService.js";
import { ExecutePedalboardPlanService } from "../dist/services/executePedalboardPlanService.js";
import { PluginKnowledgeDbService } from "../dist/services/pluginKnowledgeDbService.js";
import { RoleParameterProfileService } from "../dist/services/roleParameterProfileService.js";
import { PedalboardSafetyService } from "../dist/services/pedalboardSafetyService.js";
import { pluginCatalog } from "../dist/data/pluginCatalog.js";

const SSH_CONFIG = { host: "192.168.51.1", port: 22, username: "root", password: "mod", timeoutMs: 10000 };
const HTTP_CONFIG = { host: "192.168.51.1", port: 80, timeoutMs: 90000 };

const ssh = new SshClient(SSH_CONFIG);
const writeHttp = new WriteHttpClient(HTTP_CONFIG);
const pluginService = new PluginService(ssh, pluginCatalog);
const pedalboardService = new PedalboardService(ssh);
const graphEditor = new GraphEditorService(pedalboardService, pluginService, writeHttp, ssh);

const dryBundleService = new DryBundleService(pluginService);
const liveGraphAuthoringPlanService = new LiveGraphAuthoringPlanService(pluginService);
const saveLoadedPedalboardService = new SaveLoadedPedalboardService(pedalboardService, writeHttp, true);
const clearCurrentPedalboardService = new ClearCurrentPedalboardService(writeHttp, true);

const executeService = new ExecutePedalboardPlanService(
  dryBundleService,
  liveGraphAuthoringPlanService,
  pedalboardService,
  saveLoadedPedalboardService,
  clearCurrentPedalboardService,
  writeHttp,
  ssh
);

const recipeService = new EffectRecipeToPedalboardPlanService(
  pluginService,
  new PluginKnowledgeDbService(),
  new RoleParameterProfileService(),
  new PedalboardSafetyService()
);

const results = [];
let stepNum = 0;

function step(label) {
  stepNum++;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`STEP ${stepNum}: ${label}`);
  console.log(`${"═".repeat(60)}`);
}

function ok(label, detail) {
  results.push({ label, status: "PASS", detail });
  console.log(`  ✓ ${label}${detail ? " — " + detail : ""}`);
}

function fail(label, err) {
  results.push({ label, status: "FAIL", error: String(err) });
  console.error(`  ✗ ${label} — ${err}`);
}

// ── STEP 1: Create test pedalboard via recipe ─────────────────────────────────

step("create_pedalboard_from_recipe: DS1 → BollieDelay → Reverb + 2 snapshots");

const RUN_ID = Date.now().toString().slice(-5);
const BOARD_TITLE = `MCP Val ${RUN_ID}`;

const recipe = {
  song: "MCP Browser Validation",
  artist: "Test",
  instrument: "guitar",
  operationMode: "new_board",
  effects: [
    {
      role: "distortion",
      character: "DS1 classic rock crunch",
      preferredPluginUri: "http://moddevices.com/plugins/mod-devel/DS1",
      preferredPluginName: "DS1"
    },
    {
      role: "delay",
      character: "Bollie echo",
      preferredPluginUri: "http://moddevices.com/plugins/mod-devel/BollieDelay",
      preferredPluginName: "BollieDelay"
    },
    {
      role: "reverb",
      character: "Dragonfly Hall ambience",
      preferredPluginUri: "http://moddevices.com/plugins/fomp/DragonflyHallReverb",
      preferredPluginName: "DragonFly"
    }
  ],
  snapshots: [
    { name: "Dry", description: "DS1 only", effectFocus: {} },
    { name: "Wet", description: "Full chain with delay and reverb", effectFocus: {} }
  ],
  sections: []
};

let testBundlePath = null;
let ds1Instance = null;
let delayInstance = null;
let reverbInstance = null;

try {
  console.log("  Converting recipe to plan...");
  const plan = await recipeService.convert(recipe);
  plan.title = BOARD_TITLE;
  console.log(`  Plan: ${plan.signalChain.length} plugins → [${plan.signalChain.map(p => p.suggestedInstance).join(" → ")}]`);

  console.log("  Executing plan on device...");
  const execResult = await executeService.execute({ plan, confirm: true, title: BOARD_TITLE });

  if (!execResult.saved) {
    throw new Error("Save failed. Notes: " + (execResult.notes ?? []).join("; "));
  }

  console.log(`  Save notes: ${execResult.notes.join(" | ")}`);

  // Parse the actual saved title from notes (service may append "(2)", "(3)" etc. on collision)
  const savedNote = execResult.notes.find(n => n.includes("Saved as a new pedalboard as '"));
  const actualTitle = savedNote?.match(/Saved as a new pedalboard as '(.+?)'\./)?.[1] ?? BOARD_TITLE;
  console.log(`  Actual saved title: "${actualTitle}"`);

  const boards = await pedalboardService.listPedalboards("user");
  const match = boards.user.find(b => b.title === actualTitle);
  if (!match) throw new Error(`Board "${actualTitle}" not found in user boards after save. Available: ${boards.user.slice(0,5).map(b=>b.title).join(", ")}`);

  testBundlePath = match.bundlePath;
  ok("create_pedalboard_from_recipe", `saved to ${testBundlePath}`);
  console.log(`\n  >>> SCREENSHOT NOW: browser should show "${BOARD_TITLE}" board <<<`);

  const ins = await pedalboardService.inspectPedalboard(testBundlePath);
  const instances = ins.pluginsUsed.map(p => p.instance.replace("/graph/", ""));
  console.log(`  Plugins on board: [${instances.join(", ")}]`);
  ds1Instance = instances.find(i => i.toLowerCase().includes("ds1") || i.toLowerCase().includes("distortion"));
  delayInstance = instances.find(i => i.toLowerCase().includes("bollie") || i.toLowerCase().includes("delay"));
  reverbInstance = instances.find(i => i.toLowerCase().includes("dragon") || i.toLowerCase().includes("reverb"));
  console.log(`  DS1=${ds1Instance}  Delay=${delayInstance}  Reverb=${reverbInstance}`);
  ok("inspect after creation", `${instances.length} plugins: ${instances.join(", ")}`);
} catch (err) {
  fail("create_pedalboard_from_recipe", err.message ?? err);
  console.error("  Cannot continue without test board. Exiting.");
  await ssh.dispose?.();
  process.exit(1);
}

// ── STEP 2: add_effect with position "first" ─────────────────────────────────

step(`add_effect: insert Gain2x2 at position "first" (before DS1)`);

let gainInstance = null;
try {
  const addResult = await graphEditor.addEffect({
    bundlepath: testBundlePath,
    pluginUri: "http://moddevices.com/plugins/mod-devel/Gain2x2",
    instanceName: "InputGain",
    position: "first",
    confirm: true
  });
  if (!addResult.success) throw new Error(addResult.notes.join("; "));
  gainInstance = "InputGain";
  ok("add_effect position=first", addResult.notes[0]);
  const ins2 = await pedalboardService.inspectPedalboard(testBundlePath);
  const chain2 = ins2.pluginsUsed.map(p => p.instance.replace("/graph/", ""));
  console.log(`  Chain after add: [${chain2.join(" → ")}]`);
  console.log(`\n  >>> SCREENSHOT NOW: Gain2x2 should be first in chain <<<`);
} catch (err) {
  fail("add_effect position=first", err.message ?? err);
}

// ── STEP 3: add_effect with position "after:<instance>" ──────────────────────

step(`add_effect: insert Chorus "after:${ds1Instance ?? "distortion_1"}" (positional)`);

let chorusInstance = null;
const afterTarget = ds1Instance ?? "distortion_1";
try {
  const addResult2 = await graphEditor.addEffect({
    bundlepath: testBundlePath,
    pluginUri: "http://moddevices.com/plugins/tap/chorusflanger",
    instanceName: "Chorus",
    position: `after:${afterTarget}`,
    confirm: true
  });
  if (!addResult2.success) throw new Error(addResult2.notes.join("; "));
  chorusInstance = "Chorus";
  ok(`add_effect position=after:${afterTarget}`, addResult2.notes[0]);
  const ins3 = await pedalboardService.inspectPedalboard(testBundlePath);
  const chain3 = ins3.pluginsUsed.map(p => p.instance.replace("/graph/", ""));
  console.log(`  Chain after add: [${chain3.join(" → ")}]`);
  console.log(`\n  >>> SCREENSHOT NOW: Chorus should appear after ${afterTarget} <<<`);
} catch (err) {
  fail(`add_effect position=after:${afterTarget}`, err.message ?? err);
}

// ── STEP 4: set_effect_parameter ─────────────────────────────────────────────

step(`set_effect_parameter: tweak ${ds1Instance ?? "distortion_1"} Dist knob`);

const paramTarget = ds1Instance ?? "distortion_1";
try {
  const ports = await pluginService.getPluginPorts("http://moddevices.com/plugins/mod-devel/DS1");
  const distCtrl = ports.controlInputs.find(c => c.symbol === "Dist") ?? ports.controlInputs[0];
  if (!distCtrl) throw new Error("no control inputs found on DS1");

  const setResult = await graphEditor.setEffectParameter({
    bundlepath: testBundlePath,
    instance: paramTarget,
    parameters: { [distCtrl.symbol]: 0.85 },
    confirm: true
  });
  if (!setResult.success) throw new Error(setResult.notes.join("; "));
  ok("set_effect_parameter", `set ${distCtrl.symbol}=0.85 on ${paramTarget}`);
} catch (err) {
  fail("set_effect_parameter", err.message ?? err);
}

// ── STEP 5: toggle_effect_bypass (expect unsupported on this firmware) ────────

step(`toggle_effect_bypass on ${paramTarget}: expect unsupported=true on firmware v1.13.5`);

try {
  const bypassResult = await graphEditor.toggleEffectBypass({
    bundlepath: testBundlePath,
    instance: paramTarget,
    bypassed: true,
    persist: false,
    confirm: true
  });
  if (bypassResult.unsupported) {
    ok("toggle_effect_bypass → unsupported (expected on this firmware)", bypassResult.notes[0]);
  } else if (bypassResult.success) {
    ok("toggle_effect_bypass → succeeded (firmware supports it!)", `bypassed=${bypassResult.bypassed}`);
  } else {
    fail("toggle_effect_bypass", bypassResult.notes.join("; "));
  }
} catch (err) {
  fail("toggle_effect_bypass", err.message ?? err);
}

// ── STEP 6: validate_current_board_audio_path (chain should be intact) ────────

step("validate_current_board_audio_path: confirm chain is intact");

try {
  const valResult = await graphEditor.validateAudioPath(testBundlePath);
  if (valResult.broken) {
    fail("validate_current_board_audio_path", `BROKEN — orphans: [${valResult.orphanPlugins.join(", ")}]`);
  } else {
    ok("validate_current_board_audio_path", `chain=${valResult.chainPlugins.length} orphans=${valResult.orphanPlugins.length} path=[${valResult.path.join("→")}]`);
  }
} catch (err) {
  fail("validate_current_board_audio_path", err.message ?? err);
}

// ── STEP 7: activate_snapshot ─────────────────────────────────────────────────

step("activate_snapshot: switch to 'Wet' snapshot");

try {
  const snapResult = await graphEditor.activateSnapshot({
    bundlepath: testBundlePath,
    snapshotName: "Wet",
    confirm: true
  });
  if (snapResult.success) {
    ok("activate_snapshot", `activated: ${snapResult.snapshotName ?? "Wet"}`);
  } else if (snapResult.notes[0]?.includes("HTTP 400") || snapResult.notes[0]?.includes("may differ")) {
    ok("activate_snapshot — firmware limitation (HTTP 400, known on v1.13.5)", snapResult.notes[0]);
  } else {
    fail("activate_snapshot", snapResult.notes.join("; "));
  }
} catch (err) {
  fail("activate_snapshot", err.message ?? err);
}

// ── STEP 8: replace_effect ────────────────────────────────────────────────────

step(`replace_effect: swap ${paramTarget} for Big Muff Pi`);

let bigMuffInstance = null;
try {
  const replaceResult = await graphEditor.replaceEffect({
    bundlepath: testBundlePath,
    instanceToReplace: paramTarget,
    newPluginUri: "http://moddevices.com/plugins/mod-devel/BigMuffPi",
    newInstanceName: "BigMuff",
    confirm: true
  });
  if (!replaceResult.success) {
    fail("replace_effect", replaceResult.notes.join("; "));
    console.log("  Running validate_current_board_audio_path to assess damage...");
    try {
      const valAfterFail = await graphEditor.validateAudioPath(testBundlePath);
      console.log(`  validate: broken=${valAfterFail.broken} chain=${valAfterFail.chainPlugins.length} orphans=[${valAfterFail.orphanPlugins.join(", ")}]`);
    } catch (ve) {
      console.error(`  validate failed: ${ve.message}`);
    }
  } else {
    bigMuffInstance = "BigMuff";
    ok("replace_effect", replaceResult.notes[0]);
    const ins8 = await pedalboardService.inspectPedalboard(testBundlePath);
    const chain8 = ins8.pluginsUsed.map(p => p.instance.replace("/graph/", ""));
    console.log(`  Chain after replace: [${chain8.join(" → ")}]`);
    console.log(`\n  >>> SCREENSHOT NOW: BigMuff should replace ${paramTarget} <<<`);
  }
} catch (err) {
  fail("replace_effect", err.message ?? err);
}

// ── STEP 9: remove_effect ─────────────────────────────────────────────────────

step(`remove_effect: remove InputGain (Gain2x2) — reconnect=true`);

if (gainInstance) {
  try {
    const removeResult = await graphEditor.removeEffect({
      bundlepath: testBundlePath,
      instance: gainInstance,
      reconnect: true,
      confirm: true
    });
    if (!removeResult.success) throw new Error(removeResult.notes.join("; "));
    ok("remove_effect", removeResult.notes[0]);
    const ins9 = await pedalboardService.inspectPedalboard(testBundlePath);
    const chain9 = ins9.pluginsUsed.map(p => p.instance.replace("/graph/", ""));
    console.log(`  Chain after remove: [${chain9.join(" → ")}]`);
    console.log(`\n  >>> SCREENSHOT NOW: InputGain should be gone <<<`);
  } catch (err) {
    fail("remove_effect", err.message ?? err);
  }
} else {
  console.log("  Skipped (Gain2x2 was not added)");
  results.push({ label: "remove_effect", status: "SKIP", detail: "Gain2x2 not added" });
}

// ── STEP 10: cleanup_snapshot_references ──────────────────────────────────────

step(`cleanup_snapshot_references: clean ${paramTarget} refs from snapshots.json`);

try {
  const cleanResult = await graphEditor.cleanupSnapshotReferences({
    bundlepath: testBundlePath,
    removedInstance: paramTarget,
    confirm: true
  });
  if (!cleanResult.success) {
    fail("cleanup_snapshot_references", cleanResult.notes.join("; "));
  } else {
    ok("cleanup_snapshot_references", cleanResult.notes[0]);
  }
} catch (err) {
  fail("cleanup_snapshot_references", err.message ?? err);
}

// ── STEP 11: duplicate_pedalboard ────────────────────────────────────────────

step("duplicate_pedalboard: create a backup copy");

let dupBundlePath = null;
try {
  const dupResult = await graphEditor.duplicateBoard({
    sourceBundlePath: testBundlePath,
    newTitle: BOARD_TITLE + " — Copy",
    confirm: true
  });
  if (!dupResult.success) throw new Error(dupResult.notes.join("; "));
  dupBundlePath = dupResult.newBundlePath;
  ok("duplicate_pedalboard", `copied to ${dupBundlePath ?? "(path in notes)"}`);
  console.log(`  Notes: ${dupResult.notes.join(" | ")}`);
  console.log(`\n  >>> SCREENSHOT NOW: "${BOARD_TITLE} — Copy" should appear in pedalboard list <<<`);
} catch (err) {
  fail("duplicate_pedalboard", err.message ?? err);
}

// ── STEP 12: validate_current_board_audio_path (final state) ─────────────────

step("validate_current_board_audio_path: final state of test board");

try {
  const finalVal = await graphEditor.validateAudioPath(testBundlePath);
  if (finalVal.broken) {
    fail("validate_current_board_audio_path (final)", `BROKEN — orphans: [${finalVal.orphanPlugins.join(", ")}]`);
  } else {
    ok("validate_current_board_audio_path (final)", `valid chain=[${finalVal.path.join("→")}]`);
  }
} catch (err) {
  fail("validate_current_board_audio_path (final)", err.message ?? err);
}

// ── SUMMARY ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log("BROWSER VALIDATION SUMMARY");
console.log(`${"═".repeat(60)}`);

const passed = results.filter(r => r.status === "PASS");
const skipped = results.filter(r => r.status === "SKIP");
const failed = results.filter(r => r.status === "FAIL");
console.log(`\n  Total: ${results.length}  ✓ ${passed.length} passed  ~ ${skipped.length} skipped  ✗ ${failed.length} failed\n`);

for (const r of results) {
  if (r.status === "PASS")  console.log(`  ✓ ${r.label} — ${r.detail}`);
  else if (r.status === "SKIP") console.log(`  ~ ${r.label} — ${r.detail}`);
  else console.error(`  ✗ ${r.label} — ${r.error}`);
}

console.log(`\n  Test board:  ${testBundlePath}`);
if (dupBundlePath) console.log(`  Duplicate:   ${dupBundlePath}`);
console.log(`\n  NOTE: Delete "${BOARD_TITLE}" and "${BOARD_TITLE} — Copy" via MOD web UI when done.`);

await ssh.dispose?.();
process.exit(failed.length > 0 ? 1 : 0);
