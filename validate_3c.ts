import { createClients } from "./src/clients/modDwarfClient.js";
import { loadEnv } from "./src/schemas/env.js";
import { PedalboardPlannerService } from "./src/services/pedalboardPlannerService.js";
import { DryBundleService } from "./src/services/dryBundleService.js";
import { ImportBundleService } from "./src/services/importBundleService.js";
import { PedalboardService } from "./src/services/pedalboardService.js";
import { PluginService } from "./src/services/pluginService.js";

async function main() {
  const config = loadEnv();
  const clients = createClients(config);

  const pluginService = new PluginService(clients.ssh);
  const pedalboardService = new PedalboardService(clients.ssh);
  const planner = new PedalboardPlannerService(pluginService, pedalboardService);
  const dryBundleService = new DryBundleService(pluginService);
  const importService = new ImportBundleService(
    pedalboardService,
    clients.writeHttp,
    clients.writeToolsEnabled
  );

  console.log("--- Milestone 3C: Real Device Validation ---");
  console.log(`Target Name: AI_TEST_PORT_FIX_01`);
  console.log(`MOD Dwarf Host: ${config.MOD_DWARF_HOST}`);

  try {
    // 1. Plan
    console.log("\n1. Planning pedalboard...");
    const plan = await planner.planFromPrompt({
      style: "Ambient Rock",
      instrument: "Guitar",
      goals: ["Stereo Delay", "Clean Reverb", "Input Gain"]
    });
    console.log(`Expected Plugin URIs: ${plan.signalChain.map((p) => p.uri).join(", ")}`);

    // 2. Generate Dry Bundle
    console.log("\n2. Generating dry bundle locally...");
    const dryBundle = await dryBundleService.createDryBundle(plan);
    console.log(`Dry bundle generated at: ${dryBundle.bundlePath}`);

    // 3. Import via load_web
    console.log("\n3. Importing via load_web (no save, no backup)...");
    const result = await importService.importDryBundle({
      dryBundle,
      confirm: true,
      targetName: "AI_TEST_PORT_FIX_01"
    });

    // 4. Report
    console.log("\n--- Results ---");
    console.log(`Import Success: ${result.import.success}`);
    if ("error" in result.import && result.import.error) {
      console.error(`Import Error: ${result.import.error}`);
    }

    if (result.loadedGraphValidation) {
      const v = result.loadedGraphValidation;
      console.log(`Validation Success: ${v.success}`);
      console.log(`Plugin Count: ${v.pluginCount}`);
      console.log(`Expected URIs: ${v.expectedPluginUris.join(", ")}`);
      console.log(`Actual URIs:   ${v.actualPluginUris.join(", ")}`);
      if (v.error) console.error(`Validation Error: ${v.error}`);
    } else {
      console.error("No loadedGraphValidation returned.");
    }

    console.log("\nAPI Calls Made:");
    result.apiCalls.forEach((call) => {
      console.log(`- ${call.method} ${call.path} (${call.purpose}) -> ${call.status}`);
    });

    const success = result.import.success && result.loadedGraphValidation?.success;
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error("\nValidation failed with error:");
    console.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
