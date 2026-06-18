import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { EnvConfig } from "../schemas/env.js";
import type { SshClient } from "../clients/sshClient.js";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import { pluginCatalog } from "../data/pluginCatalog.js";
import { DeviceInventoryService } from "../services/deviceInventoryService.js";
import { ClearCurrentPedalboardService } from "../services/clearCurrentPedalboardService.js";
import { CreateNewPedalboardService } from "../services/createNewPedalboardService.js";
import { PluginService } from "../services/pluginService.js";
import { PedalboardService } from "../services/pedalboardService.js";
import { DryBundleService } from "../services/dryBundleService.js";
import { LiveGraphAuthoringPlanService } from "../services/liveGraphAuthoringPlan.js";
import { SaveLoadedPedalboardService } from "../services/saveLoadedPedalboardService.js";
import { ExecutePedalboardPlanService } from "../services/executePedalboardPlanService.js";
import { EffectRecipeToPedalboardPlanService } from "../services/effectRecipeToPedalboardPlanService.js";
import { PluginKnowledgeDbService } from "../services/pluginKnowledgeDbService.js";
import { RoleParameterProfileService } from "../services/roleParameterProfileService.js";
import { PedalboardSafetyService } from "../services/pedalboardSafetyService.js";
import type { EffectRecipe } from "../types/plan.js";

interface CliClients {
  ssh: SshClient;
  writeHttp: WriteHttpClient | null;
  writeToolsEnabled: boolean;
}

export async function runCli(
  args: string[],
  config: EnvConfig,
  clients: CliClients
): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case "refresh-inventory":
      await cmdRefreshInventory(clients);
      break;
    case "clear-board":
      await cmdClearBoard(rest, clients);
      break;
    case "create-empty":
      await cmdCreateEmpty(rest, clients);
      break;
    case "create-from-recipe":
      await cmdCreateFromRecipe(rest, clients);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

async function cmdRefreshInventory(clients: CliClients): Promise<void> {
  console.log("Refreshing device inventory via SSH...");
  const service = new DeviceInventoryService(clients.ssh);
  const result = await service.refresh();
  console.log(`Inventory refreshed: ${result.pluginCount} plugins found.`);
  console.log(`Written to: ${result.inventoryPath}`);
  await saveReport("refresh-inventory", JSON.stringify(result, null, 2));
}

async function cmdClearBoard(args: string[], clients: CliClients): Promise<void> {
  requireWriteTools(clients);
  requireConfirm(args, "clear-board");
  console.log("Clearing current board...");
  const service = new ClearCurrentPedalboardService(clients.writeHttp, clients.writeToolsEnabled);
  const result = await service.clear({ confirm: true });
  if (result.success) {
    console.log(`Board cleared. Removed ${result.removedInstances.length} plugin(s).`);
  } else {
    console.error("Clear failed.", result.notes.join("\n"));
    process.exit(1);
  }
  await saveReport("clear-board", JSON.stringify(result, null, 2));
}

async function cmdCreateEmpty(args: string[], clients: CliClients): Promise<void> {
  requireWriteTools(clients);
  const titleIndex = args.findIndex((a) => !a.startsWith("--"));
  if (titleIndex === -1) {
    console.error("Usage: mod-dwarf-mcp create-empty <title> --confirm");
    process.exit(1);
  }
  const title = args[titleIndex];
  requireConfirm(args, "create-empty");
  console.log(`Creating empty board: "${title}"...`);
  const service = new CreateNewPedalboardService(clients.writeHttp, clients.writeToolsEnabled);
  const result = await service.create({ title, confirm: true });
  if (result.saved?.success) {
    console.log(`Empty board "${title}" created and saved.`);
  } else {
    console.error("Create-empty failed.", result.notes?.join("\n") ?? "");
    process.exit(1);
  }
  await saveReport("create-empty", JSON.stringify(result, null, 2));
}

async function cmdCreateFromRecipe(args: string[], clients: CliClients): Promise<void> {
  requireWriteTools(clients);
  const pathIndex = args.findIndex((a) => !a.startsWith("--"));
  if (pathIndex === -1) {
    console.error("Usage: mod-dwarf-mcp create-from-recipe <recipe_json_path> --confirm");
    process.exit(1);
  }
  const recipePath = resolve(args[pathIndex]);
  requireConfirm(args, "create-from-recipe");

  let recipe: EffectRecipe;
  try {
    const raw = await readFile(recipePath, "utf8");
    recipe = JSON.parse(raw) as EffectRecipe;
  } catch (err) {
    console.error(
      `Failed to read recipe file "${recipePath}":`,
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  console.log(
    `Creating board from recipe: ${recipe.artist ?? ""} ${recipe.song ?? ""}`.trim() || recipePath
  );

  const pluginService = new PluginService(clients.ssh, pluginCatalog);
  const pedalboardService = new PedalboardService(clients.ssh);
  const saveLoadedService = new SaveLoadedPedalboardService(
    pedalboardService,
    clients.writeHttp,
    clients.writeToolsEnabled
  );

  const recipeService = new EffectRecipeToPedalboardPlanService(
    pluginService,
    new PluginKnowledgeDbService(),
    new RoleParameterProfileService(),
    new PedalboardSafetyService()
  );
  const executeService = new ExecutePedalboardPlanService(
    new DryBundleService(pluginService),
    new LiveGraphAuthoringPlanService(pluginService),
    pedalboardService,
    saveLoadedService,
    new ClearCurrentPedalboardService(clients.writeHttp, clients.writeToolsEnabled),
    clients.writeHttp,
    clients.ssh
  );

  const plan = await recipeService.convert(recipe);
  const title = [recipe.artist, recipe.song].filter(Boolean).join(" — ") || "Unnamed Board";

  const result = await executeService.execute({ plan, confirm: true, title });

  if (result.saved) {
    console.log(`Board "${result.title}" created and saved.`);
    if (result.notes.length > 0) {
      for (const note of result.notes) console.log(" ·", note);
    }
  } else {
    console.error("Create-from-recipe failed.");
    for (const note of result.notes) console.error(" ·", note);
    process.exit(1);
  }
  await saveReport("create-from-recipe", JSON.stringify(result, null, 2));
}

function requireWriteTools(clients: CliClients): void {
  if (!clients.writeToolsEnabled || !clients.writeHttp) {
    console.error("Error: write operations require MOD_DWARF_ENABLE_WRITE_TOOLS=true");
    process.exit(1);
  }
}

function requireConfirm(args: string[], command: string): void {
  if (!args.includes("--confirm")) {
    console.error(`Error: ${command} is destructive — add --confirm to proceed`);
    process.exit(1);
  }
}

async function saveReport(command: string, body: string): Promise<void> {
  try {
    await mkdir("final_reports", { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const path = `final_reports/cli_${command}_${stamp}.txt`;
    await writeFile(path, body + "\n", "utf8");
    console.log(`Report saved: ${path}`);
  } catch {
    // non-fatal
  }
}

function printUsage(): void {
  console.error(
    [
      "Usage: mod-dwarf-mcp [command]",
      "",
      "  (no command)                         Start MCP stdio server",
      "  refresh-inventory                    Refresh device plugin inventory via SSH",
      "  clear-board --confirm                Clear the current active board",
      "  create-empty <title> --confirm       Create and save an empty board",
      "  create-from-recipe <path> --confirm  Create a board from a JSON recipe file"
    ].join("\n")
  );
}
