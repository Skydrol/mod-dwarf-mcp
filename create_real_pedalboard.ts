import { createClients } from "./src/clients/modDwarfClient.js";
import { loadEnv } from "./src/schemas/env.js";
import { PedalboardPlannerService } from "./src/services/pedalboardPlannerService.js";
import { DryBundleService } from "./src/services/dryBundleService.js";
import { ImportBundleService } from "./src/services/importBundleService.js";
import { SaveLoadedPedalboardService } from "./src/services/saveLoadedPedalboardService.js";
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
  const saveService = new SaveLoadedPedalboardService(
    pedalboardService,
    clients.writeHttp,
    clients.writeToolsEnabled
  );

  const title = "AI_PORT_FIX_REAL_01";

  try {
    // 1. Check if exists
    const exists = await pedalboardService.pedalboardTitleExists(title, "user");
    if (exists) {
      console.error(`Pedalboard '${title}' already exists.`);
      process.exit(1);
    }

    // 2. Plan
    console.log(`\nPlanning: ${title}...`);
    const plan = await planner.planFromPrompt({
      style: "Clean",
      instrument: "Guitar",
      goals: ["Input Gain", "Delay", "Reverb", "Output Gain"]
    });

    // 3. Generate
    const dryBundle = await dryBundleService.createDryBundle(plan);

    // 4. Import
    console.log(`\nImporting...`);
    const importRes = await importService.importDryBundle({
      dryBundle,
      confirm: true,
      targetName: title
    });

    if (!importRes.import.success || !importRes.loadedGraphValidation?.success) {
      console.error("Import/Validation failed.");
      process.exit(1);
    }

    // 5. Save
    console.log(`\nSaving...`);
    const saveRes = await saveService.saveAsNew({
      title,
      confirm: true,
      expectedPluginUris: plan.signalChain.map((p) => p.uri).filter((u): u is string => !!u),
      loadedBundlePath: importRes.loadedGraphValidation.bundlePath ?? undefined
    });

    if (saveRes.saved.success) {
      console.log("Successfully created and saved pedalboard.");
    } else {
      console.error(`Save failed: ${saveRes.saved.error}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
