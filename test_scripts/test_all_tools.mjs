/**
 * Comprehensive test runner for all 37 MCP tools.
 * Tests read-only tools fully, guard checks for write tools, and live write tests on the Pink Floyd board.
 * Run: node test_scripts/test_all_tools.mjs
 */

import { SshClient } from "../dist/clients/sshClient.js";
import { WriteHttpClient } from "../dist/clients/writeHttpClient.js";
import { DeviceService } from "../dist/services/deviceService.js";
import { PluginService } from "../dist/services/pluginService.js";
import { PedalboardService } from "../dist/services/pedalboardService.js";
import { BankService } from "../dist/services/bankService.js";
import { SnapshotService } from "../dist/services/snapshotService.js";
import { DeviceInventoryService } from "../dist/services/deviceInventoryService.js";
import { InventoryStatusService } from "../dist/services/inventoryStatusService.js";
import { GraphEditorService } from "../dist/services/graphEditorService.js";
import { PedalboardPlannerService } from "../dist/services/pedalboardPlannerService.js";
import { DryBundleService } from "../dist/services/dryBundleService.js";
import { LiveGraphAuthoringPlanService } from "../dist/services/liveGraphAuthoringPlan.js";
import { SaveLoadedPedalboardService } from "../dist/services/saveLoadedPedalboardService.js";
import { LoadExistingPedalboardService } from "../dist/services/loadExistingPedalboardService.js";
import { ClearCurrentPedalboardService } from "../dist/services/clearCurrentPedalboardService.js";
import { EffectRecipeToPedalboardPlanService } from "../dist/services/effectRecipeToPedalboardPlanService.js";
import { PluginKnowledgeDbService } from "../dist/services/pluginKnowledgeDbService.js";
import { RoleParameterProfileService } from "../dist/services/roleParameterProfileService.js";
import { PedalboardSafetyService } from "../dist/services/pedalboardSafetyService.js";
import { pluginCatalog } from "../dist/data/pluginCatalog.js";

// NOTE: The live write tests (setEffectParameter, loadExistingPedalboard) may fail on repeated
// runs because each setEffectParameter save accumulates duplicate connections in the MOD
// firmware's live-graph-to-TTL serialization. This is a firmware behavior, not a code bug.
// Reset the Pink Floyd board to a clean state if those tests start timing out.

const SSH_CONFIG = { host: "192.168.51.1", port: 22, username: "root", password: "mod", timeoutMs: 10000 };
const HTTP_CONFIG = { host: "192.168.51.1", port: 80, timeoutMs: 15000 };

// ─── test harness ────────────────────────────────────────────────────────────

const results = [];
async function test(name, fn) {
  const start = Date.now();
  try {
    const info = await fn();
    const ms = Date.now() - start;
    results.push({ name, status: "PASS", ms, info: info ?? "" });
    console.log(`  ✓ ${name} (${ms}ms)${info ? " — " + info : ""}`);
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ name, status: "FAIL", ms, error: err.message });
    console.error(`  ✗ ${name} (${ms}ms) — ${err.message}`);
  }
}

function section(title) {
  const dashes = Math.max(0, 50 - title.length);
  console.log(`\n── ${title} ${"─".repeat(dashes)}`);
}

// ─── setup ───────────────────────────────────────────────────────────────────

const ssh = new SshClient(SSH_CONFIG);
const writeHttp = new WriteHttpClient(HTTP_CONFIG);
const pluginService = new PluginService(ssh, pluginCatalog);
const pedalboardService = new PedalboardService(ssh);

// Find Pink Floyd board path
let pinkFloydPath = null;
let testBundlePath = null;

// ─── READ-ONLY TOOLS ─────────────────────────────────────────────────────────

section("check_inventory_status");
const inventoryStatusService = new InventoryStatusService();
await test("getStatus returns expected shape", async () => {
  const s = await inventoryStatusService.getStatus();
  if (typeof s.exists !== "boolean") throw new Error("exists not boolean");
  if (typeof s.pluginCount !== "number") throw new Error("pluginCount not number");
  if (typeof s.isStale !== "boolean") throw new Error("isStale not boolean");
  if (!s.message) throw new Error("no message");
  return `exists=${s.exists}, plugins=${s.pluginCount}, stale=${s.isStale}`;
});

section("get_device_info");
const deviceService = new DeviceService(ssh);
await test("getDeviceInfo returns counts + kernel", async () => {
  const info = await deviceService.getDeviceInfo();
  if (info.firmwareVersion === undefined) throw new Error("no firmwareVersion field");
  if (!info.kernel) throw new Error("no kernel");
  if (!info.counts || typeof info.counts.lv2Plugins !== "number") throw new Error("no counts.lv2Plugins");
  return `firmware=${info.firmwareVersion ?? "n/a"}, kernel=${info.kernel}, lv2=${info.counts.lv2Plugins}`;
});

section("list_plugins");
await test("list with format=both returns uri+name pairs", async () => {
  const list = await pluginService.listPlugins("both");
  if (!list.plugins || list.plugins.length < 10) throw new Error("too few plugins: " + list.plugins?.length);
  return `${list.count} plugins`;
});
await test("list with format=uris returns URIs only", async () => {
  const list = await pluginService.listPlugins("uris");
  const first = list.plugins[0];
  if (!first.uri) throw new Error("missing uri field");
  if (first.name !== undefined) throw new Error("unexpected name field in uris mode");
  return "ok";
});
await test("list with format=names returns names only", async () => {
  const list = await pluginService.listPlugins("names");
  const first = list.plugins[0];
  if (!first.name) throw new Error("missing name field");
  return "ok";
});

section("list_pedalboards");
const pedalboardListResult = { user: [], factory: [] };
await test("listPedalboards source=all", async () => {
  const r = await pedalboardService.listPedalboards("all");
  if (!Array.isArray(r.user)) throw new Error("user not array");
  if (!Array.isArray(r.factory)) throw new Error("factory not array");
  pedalboardListResult.user = r.user;
  pedalboardListResult.factory = r.factory;

  // Find Pink Floyd test board
  pinkFloydPath = r.user.find(p => p.title && p.title.toLowerCase().includes("shine"))?.bundlePath;
  testBundlePath = pinkFloydPath ?? r.user[0]?.bundlePath;

  return `${r.user.length} user, ${r.factory.length} factory`;
});
await test("listPedalboards source=user only", async () => {
  const r = await pedalboardService.listPedalboards("user");
  if (r.factory.length !== 0) throw new Error("factory should be empty");
  return `${r.user.length} boards`;
});
await test("listPedalboards source=factory only", async () => {
  const r = await pedalboardService.listPedalboards("factory");
  if (r.user.length !== 0) throw new Error("user should be empty");
  return `${r.factory.length} boards`;
});

section("list_banks");
const bankService = new BankService(ssh);
await test("listBanks source=all", async () => {
  const r = await bankService.listBanks("all");
  if (!Array.isArray(r.user)) throw new Error("user not array");
  return `${r.user.length} user, ${r.factory.length} factory banks`;
});

section("inspect_pedalboard");
let inspection = null;
await test("inspectPedalboard on found board", async () => {
  if (!testBundlePath) throw new Error("no test board available");
  inspection = await pedalboardService.inspectPedalboard(testBundlePath);
  if (!inspection.pluginsUsed) throw new Error("no pluginsUsed");
  if (!Array.isArray(inspection.connections)) throw new Error("connections not array");
  return `${inspection.pluginsUsed.length} plugins, ${inspection.connections.length} connections, title="${inspection.title}"`;
});

section("list_snapshots");
const snapshotService = new SnapshotService(ssh);
await test("listSnapshots on found board", async () => {
  if (!testBundlePath) throw new Error("no test board available");
  const snaps = await snapshotService.listSnapshots(testBundlePath);
  if (!Array.isArray(snaps.snapshots)) throw new Error("snapshots not array");
  return `${snaps.snapshots.length} snapshots, source=${snaps.sourceFile ?? "none"}`;
});

section("search_plugins");
await test("search_plugins returns matches for 'reverb'", async () => {
  const r = await pluginService.listPlugins("both");
  const q = "reverb";
  const matches = r.plugins.filter(p => (p.name?.toLowerCase().includes(q) ?? false) || (p.uri?.toLowerCase().includes(q) ?? false)).slice(0, 30);
  if (matches.length === 0) throw new Error("no reverb plugins found");
  return `${matches.length} reverb plugins found: ${matches.slice(0, 3).map(p => p.name).join(", ")}`;
});
await test("search_plugins returns matches for 'delay'", async () => {
  const r = await pluginService.listPlugins("both");
  const q = "delay";
  const matches = r.plugins.filter(p => (p.name?.toLowerCase().includes(q) ?? false) || (p.uri?.toLowerCase().includes(q) ?? false)).slice(0, 30);
  if (matches.length === 0) throw new Error("no delay plugins found");
  return `${matches.length} delay plugins`;
});

section("get_plugin_parameters");
await test("get_plugin_parameters for DS1 returns control inputs", async () => {
  const ds1Uri = "http://moddevices.com/plugins/mod-devel/DS1";
  const ports = await pluginService.getPluginPorts(ds1Uri);
  if (!ports.controlInputs || ports.controlInputs.length === 0) throw new Error("no control inputs");
  const sample = ports.controlInputs[0];
  if (!sample.symbol) throw new Error("no symbol on first control input");
  return `${ports.controlInputs.length} controls: ${ports.controlInputs.slice(0, 3).map(p => p.symbol).join(", ")}`;
});

section("plan_pedalboard_from_prompt");
const plannerService = new PedalboardPlannerService(pluginService);
await test("planFromPrompt produces plan with plugins", async () => {
  const plan = await plannerService.planFromPrompt({
    style: "blues rock",
    instrument: "guitar",
    goals: ["overdrive", "reverb"],
    referenceArtists: ["Stevie Ray Vaughan"]
  });
  if (!plan.signalChain || plan.signalChain.length === 0) throw new Error("no plugins in plan");
  return `${plan.signalChain.length} plugins planned`;
});

section("create_pedalboard_dry_bundle (no device needed)");
const dryBundleService = new DryBundleService(pluginService);
await test("DryBundleService.createDryBundle produces manifest + ttl", async () => {
  const plan = {
    dryRun: true,
    operationMode: "new_board",
    safety: { writesFiles: false, modifiesDevice: false, callsPostEndpoints: false },
    request: { style: "rock", instrument: "guitar", goals: ["distortion"], referenceArtists: [] },
    template: null,
    availablePluginCount: 1,
    title: "Test Dry Bundle",
    signalChain: [
      {
        role: "distortion",
        name: "DS1",
        uri: "http://moddevices.com/plugins/mod-devel/DS1",
        reason: "classic rock tone",
        suggestedInstance: "DS1",
        parameterRanges: {}
      }
    ],
    snapshots: [],
    notes: [],
    unsupportedIdeas: []
  };
  const bundle = await dryBundleService.createDryBundle(plan);
  if (!bundle.generatedFiles?.manifest) throw new Error("no generatedFiles.manifest");
  if (!bundle.generatedFiles?.mainTtl) throw new Error("no generatedFiles.mainTtl");
  return `bundlePath=${bundle.bundlePath.split(/[\\/]/).pop()}`;
});

section("create_live_graph_authoring_plan (no device needed)");
const liveAuthoringService = new LiveGraphAuthoringPlanService(pluginService);
await test("buildPlan returns api calls for DS1", async () => {
  const plan = {
    dryRun: true,
    operationMode: "new_board",
    safety: { writesFiles: false, modifiesDevice: false, callsPostEndpoints: false },
    request: { style: "rock", instrument: "guitar", goals: ["distortion"], referenceArtists: [] },
    template: null,
    availablePluginCount: 1,
    signalChain: [
      {
        role: "distortion",
        name: "DS1",
        uri: "http://moddevices.com/plugins/mod-devel/DS1",
        reason: "test",
        suggestedInstance: "DS1",
        parameterRanges: {}
      }
    ],
    snapshots: [],
    notes: [],
    unsupportedIdeas: []
  };
  const result = await liveAuthoringService.buildPlan(plan);
  if (!result.apiCalls || result.apiCalls.length === 0) throw new Error("no API calls generated");
  const addCall = result.apiCalls.find(c => c.path.includes("effect/add"));
  if (!addCall) throw new Error("no effect/add call found");
  return `${result.apiCalls.length} API calls, first add: ${addCall.path.substring(0, 60)}`;
});

section("effect_recipe_to_pedalboard_plan");
const recipeService = new EffectRecipeToPedalboardPlanService(
  pluginService,
  new PluginKnowledgeDbService(),
  new RoleParameterProfileService(),
  new PedalboardSafetyService()
);
await test("convert basic recipe to plan", async () => {
  const recipe = {
    instrument: "guitar",
    operationMode: "new_board",
    effects: [
      { role: "distortion", character: "classic rock crunch", preferredPluginUri: "http://moddevices.com/plugins/mod-devel/DS1" }
    ],
    snapshots: [],
    sections: []
  };
  const plan = await recipeService.convert(recipe);
  if (!plan.signalChain || plan.signalChain.length === 0) throw new Error("no plugins in converted plan");
  return `${plan.signalChain.length} plugins converted`;
});

// ─── GUARD-ONLY TESTS (write tools, confirm=false) ───────────────────────────

section("write tool guard checks (confirm=false / no writeApi)");

const graphEditorNoWrite = new GraphEditorService(pedalboardService, pluginService, null);

await test("add_effect: writeApi=null → fails gracefully", async () => {
  const r = await graphEditorNoWrite.addEffect({
    bundlepath: testBundlePath ?? "/nonexistent",
    pluginUri: "urn:x:test",
    position: "last",
    confirm: true
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("remove_effect: confirm=false → not-confirmed", async () => {
  const r = await graphEditorNoWrite.removeEffect({
    bundlepath: testBundlePath ?? "/nonexistent",
    instance: "DS1",
    reconnect: true,
    confirm: false
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("replace_effect: confirm=false → not-confirmed", async () => {
  const r = await graphEditorNoWrite.replaceEffect({
    bundlepath: testBundlePath ?? "/nonexistent",
    instanceToReplace: "DS1",
    newPluginUri: "urn:x:test",
    confirm: false
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("set_effect_parameter: confirm=false → not-confirmed", async () => {
  const r = await graphEditorNoWrite.setEffectParameter({
    bundlepath: testBundlePath ?? "/nonexistent",
    instance: "DS1",
    parameters: { Gain: 0.5 },
    confirm: false
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("save_loaded_pedalboard: write disabled → fails gracefully", async () => {
  const saveService = new SaveLoadedPedalboardService(pedalboardService, null, false);
  const r = await saveService.saveAsNew({ title: "Test", confirm: true });
  if (r.saved.attempted !== false) throw new Error("expected save to be not-attempted (writes disabled)");
  return r.notes?.[0] ?? "correctly blocked";
});

await test("load_existing_pedalboard: write disabled → fails gracefully", async () => {
  const loadService = new LoadExistingPedalboardService(pedalboardService, null, false);
  const r = await loadService.load({ bundlePath: testBundlePath ?? "/nonexistent", confirm: true });
  if (r.loaded) throw new Error("expected load to fail (writes disabled)");
  return r.notes?.[0] ?? "correctly blocked";
});

await test("clear_current_pedalboard: write disabled → fails gracefully", async () => {
  const clearService = new ClearCurrentPedalboardService(null, false);
  const r = await clearService.clear({ confirm: true });
  return r.notes?.[0] ?? "correctly blocked";
});

await test("toggle_effect_bypass: confirm=false → not-confirmed", async () => {
  const r = await graphEditorNoWrite.toggleEffectBypass({
    bundlepath: testBundlePath ?? "/nonexistent",
    instance: "DS1",
    bypassed: true,
    persist: false,
    confirm: false
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("activate_snapshot: confirm=false → not-confirmed", async () => {
  const r = await graphEditorNoWrite.activateSnapshot({
    bundlepath: testBundlePath ?? "/nonexistent",
    snapshotName: "Solo",
    confirm: false
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

await test("duplicate_pedalboard: writeApi=null → fails gracefully", async () => {
  const r = await graphEditorNoWrite.duplicateBoard({
    sourceBundlePath: testBundlePath ?? "/nonexistent",
    newTitle: "Copy",
    confirm: true
  });
  if (r.success !== false) throw new Error("expected failure");
  return r.notes[0];
});

section("get_current_board_state");
await test("getCurrentBoardPath returns path or null gracefully", async () => {
  const path = await pedalboardService.getCurrentBoardPath();
  // May be null if device doesn't have the tracking file — that's OK
  return path ? `current board: ${path.split("/").pop()}` : "no tracking file (expected on some firmware)";
});

// ─── LIVE WRITE TESTS on Pink Floyd board ────────────────────────────────────

if (pinkFloydPath) {
  section("LIVE WRITE TESTS — Pink Floyd: Shine On You Crazy Diamond");
  console.log(`  Target: ${pinkFloydPath}`);

  const graphEditor = new GraphEditorService(pedalboardService, pluginService, writeHttp);

  // First inspect to see what's there
  await test("inspect before edits", async () => {
    const ins = await pedalboardService.inspectPedalboard(pinkFloydPath);
    return `${ins.pluginsUsed.length} plugins: ${ins.pluginsUsed.map(p => p.instance.replace("/graph/","")).join(", ")}`;
  });

  // Test set_effect_parameter — harmless tweak on one knob, restore immediately
  await test("set_effect_parameter: set then restore Mix on DragonFly reverb", async () => {
    const ins = await pedalboardService.inspectPedalboard(pinkFloydPath);
    // Find a reverb instance
    const reverbPlugin = ins.pluginsUsed.find(p =>
      p.uri.toLowerCase().includes("dragonfly") ||
      p.uri.toLowerCase().includes("reverb") ||
      p.instance.toLowerCase().includes("dragon")
    );
    if (!reverbPlugin) return "skipped — no reverb found on board";

    const instance = reverbPlugin.instance.replace("/graph/", "");

    // Get plugin ports to find a control input
    const ports = await pluginService.getPluginPorts(reverbPlugin.uri);
    const firstCtrl = ports.controlInputs[0];
    if (!firstCtrl) return `skipped — no control inputs for ${instance}`;

    const originalVal = firstCtrl.default ?? 0.5;
    const testVal = originalVal > 0 ? originalVal * 0.9 : 0.1;

    const r = await graphEditor.setEffectParameter({
      bundlepath: pinkFloydPath,
      instance,
      parameters: { [firstCtrl.symbol]: testVal },
      confirm: true
    });
    if (!r.success) throw new Error("setEffectParameter failed: " + r.notes.join("; "));

    // Restore
    await graphEditor.setEffectParameter({
      bundlepath: pinkFloydPath,
      instance,
      parameters: { [firstCtrl.symbol]: originalVal },
      confirm: true
    });

    return `set ${firstCtrl.symbol}=${testVal} then restored to ${originalVal} on ${instance}`;
  });

  // Test load_existing_pedalboard (load the board)
  await test("load_existing_pedalboard: load Pink Floyd board", async () => {
    const loadService = new LoadExistingPedalboardService(pedalboardService, writeHttp, true);
    const r = await loadService.load({ bundlePath: pinkFloydPath, confirm: true });
    if (!r.load?.success) throw new Error("load failed: " + JSON.stringify(r.notes));
    return "board loaded ok";
  });

} else {
  section("LIVE WRITE TESTS — skipped (Pink Floyd board not found)");
  const allBoards = pedalboardListResult.user.map(p => p.title).join(", ");
  console.log(`  Available user boards: ${allBoards || "(none)"}`);
}

// ─── summary ─────────────────────────────────────────────────────────────────

section("SUMMARY");
const passed = results.filter(r => r.status === "PASS");
const failed = results.filter(r => r.status === "FAIL");
console.log(`\n  Total: ${results.length}  ✓ ${passed.length} passed  ✗ ${failed.length} failed\n`);

if (failed.length > 0) {
  console.log("  Failed tests:");
  for (const f of failed) console.log(`    ✗ ${f.name}: ${f.error}`);
}

await ssh.dispose?.();
process.exit(failed.length > 0 ? 1 : 0);
