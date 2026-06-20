/**
 * Test: GraphEditorService dry-run / validation paths
 *
 * Tests the confirm=false guard and noWriteApi guard without hitting the device.
 * These are unit-level tests for the service constructor, guard logic, and input validation.
 */

import { GraphEditorService } from "../dist/services/graphEditorService.js";

function makeStubPedalboardService() {
  return {
    inspectPedalboard: async () => ({
      bundlePath: "/root/.pedalboards/Test.pedalboard",
      title: "Test Board",
      source: "user",
      files: {},
      pluginsUsed: [
        { instance: "/graph/DS1", uri: "urn:example:ds1" },
        { instance: "/graph/BollieDelay", uri: "urn:example:bollie" }
      ],
      connections: [
        { tail: "/graph/capture_1", head: "/graph/DS1/In" },
        { tail: "/graph/DS1/Out", head: "/graph/BollieDelay/Audio_In" },
        { tail: "/graph/BollieDelay/Audio_Out", head: "/graph/playback_1" }
      ],
      mappings: {},
      snapshots: [],
      metadata: { format: "lv2-bundle", ttlBased: true, jsonSidecars: [] }
    })
  };
}

function makeStubPluginService() {
  return {
    getPluginPorts: async () => ({
      uri: "urn:example:reverb",
      ports: [],
      audioInputs: [{ index: 0, symbol: "Audio_In", name: "Audio In", types: [], kind: "audio", direction: "input", properties: [] }],
      audioOutputs: [{ index: 1, symbol: "Audio_Out", name: "Audio Out", types: [], kind: "audio", direction: "output", properties: [] }],
      controlInputs: []
    })
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${name} — ${err.message}`);
      failed++;
    }
  }

  const svc = new GraphEditorService(
    makeStubPedalboardService(),
    makeStubPluginService(),
    null // no writeApi
  );

  await test("addEffect with no writeApi returns failure", async () => {
    const r = await svc.addEffect({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      pluginUri: "urn:example:reverb",
      position: "last",
      confirm: true
    });
    if (r.success !== false) throw new Error("Expected success=false without writeApi");
    if (!r.notes[0].includes("Write API not configured")) throw new Error("Expected writeApi error message");
  });

  await test("addEffect with confirm=false returns not-confirmed", async () => {
    const r = await svc.addEffect({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      pluginUri: "urn:example:reverb",
      position: "last",
      confirm: false
    });
    if (r.success !== false) throw new Error("Expected success=false with confirm=false");
    if (!r.notes[0].includes("confirm must be true")) throw new Error("Expected confirm error message");
  });

  await test("removeEffect with no writeApi returns failure", async () => {
    const r = await svc.removeEffect({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      instance: "DS1",
      reconnect: true,
      confirm: true
    });
    if (r.success !== false) throw new Error("Expected success=false without writeApi");
  });

  await test("removeEffect with confirm=false returns not-confirmed", async () => {
    const r = await svc.removeEffect({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      instance: "DS1",
      reconnect: true,
      confirm: false
    });
    if (r.success !== false) throw new Error("Expected success=false with confirm=false");
  });

  await test("replaceEffect with confirm=false returns not-confirmed", async () => {
    const r = await svc.replaceEffect({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      instanceToReplace: "DS1",
      newPluginUri: "urn:example:reverb",
      confirm: false
    });
    if (r.success !== false) throw new Error("Expected success=false");
  });

  await test("setEffectParameter with confirm=false returns not-confirmed", async () => {
    const r = await svc.setEffectParameter({
      bundlepath: "/root/.pedalboards/Test.pedalboard",
      instance: "BollieDelay",
      parameters: { Time: 0.375 },
      confirm: false
    });
    if (r.success !== false) throw new Error("Expected success=false");
    if (!r.notes[0].includes("confirm must be true")) throw new Error("Expected confirm error message");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
