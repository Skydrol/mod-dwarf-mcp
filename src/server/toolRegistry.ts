import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPedalboardDryBundleTool } from "../tools/createPedalboardDryBundle.js";
import { createLiveGraphAuthoringPlanTool } from "../tools/createLiveGraphAuthoringPlan.js";
import { runLiveGraphConnectionExperimentTool } from "../tools/runLiveGraphConnectionExperiment.js";
import { runLiveGraphExperimentTool } from "../tools/runLiveGraphExperiment.js";
import { getDeviceInfoTool } from "../tools/getDeviceInfo.js";
import { importPedalboardDryBundleTool } from "../tools/importPedalboardDryBundle.js";
import { inspectPedalboardTool } from "../tools/inspectPedalboard.js";
import { listBanksTool } from "../tools/listBanks.js";
import { listPedalboardsTool } from "../tools/listPedalboards.js";
import { listPluginsTool } from "../tools/listPlugins.js";
import { listSnapshotsTool } from "../tools/listSnapshots.js";
import { loadExistingPedalboardTool } from "../tools/loadExistingPedalboard.js";
import { planPedalboardFromPromptTool } from "../tools/planPedalboardFromPrompt.js";
import { saveLoadedPedalboardAsNewTool } from "../tools/saveLoadedPedalboardAsNew.js";
import type { ToolContext } from "../tools/toolContext.js";
import { dryPedalboardBundleSchema, pedalboardPlanSchema } from "../schemas/tools.js";

export function registerTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "get_device_info",
    {
      title: "Get MOD Dwarf device info",
      description: "Read firmware, OS, kernel, LV2 plugin counts, and pedalboard counts.",
      inputSchema: {}
    },
    async (input) => getDeviceInfoTool(input, context)
  );

  server.registerTool(
    "list_plugins",
    {
      title: "List LV2 plugins",
      description: "List installed LV2 plugin names, URIs, or both.",
      inputSchema: {
        format: z.enum(["names", "uris", "both"]).default("both")
      }
    },
    async (input) => listPluginsTool(input, context)
  );

  server.registerTool(
    "list_pedalboards",
    {
      title: "List pedalboards",
      description: "List user and/or factory MOD Dwarf pedalboard bundles.",
      inputSchema: {
        source: z.enum(["user", "factory", "all"]).default("all")
      }
    },
    async (input) => listPedalboardsTool(input, context)
  );

  server.registerTool(
    "inspect_pedalboard",
    {
      title: "Inspect a pedalboard",
      description:
        "Inspect a pedalboard bundle, including plugins, connections, mappings, snapshots, and metadata.",
      inputSchema: {
        bundlePath: z.string().min(1)
      }
    },
    async (input) => inspectPedalboardTool(input, context)
  );

  server.registerTool(
    "list_banks",
    {
      title: "List banks",
      description: "List user and/or factory bank JSON entries.",
      inputSchema: {
        source: z.enum(["user", "factory", "all"]).default("all")
      }
    },
    async (input) => listBanksTool(input, context)
  );

  server.registerTool(
    "list_snapshots",
    {
      title: "List snapshots",
      description: "List snapshots for a MOD Dwarf pedalboard bundle.",
      inputSchema: {
        bundlePath: z.string().min(1)
      }
    },
    async (input) => listSnapshotsTool(input, context)
  );

  server.registerTool(
    "plan_pedalboard_from_prompt",
    {
      title: "Plan a MOD Dwarf pedalboard from a prompt",
      description:
        "Dry-run only: inspect installed plugins and existing templates, then propose a signal chain, snapshots, and parameter ranges without writing anything.",
      inputSchema: {
        style: z.string().min(1),
        instrument: z.string().min(1),
        goals: z.array(z.string().min(1)).min(1),
        referenceArtists: z.array(z.string().min(1)).optional().default([])
      }
    },
    async (input) => planPedalboardFromPromptTool(input, context)
  );

  server.registerTool(
    "import_pedalboard_dry_bundle",
    {
      title: "Import a generated dry-run pedalboard bundle",
      description:
        "Write-gated MOD UI API import for a generated dry bundle. Requires MOD_DWARF_ENABLE_WRITE_TOOLS=true and confirm=true. Never falls back to direct file writes.",
      inputSchema: {
        dryBundle: dryPedalboardBundleSchema,
        confirm: z.boolean(),
        targetName: z.string().min(1).optional()
      }
    },
    async (input) => importPedalboardDryBundleTool(input, context)
  );

  server.registerTool(
    "save_loaded_pedalboard_as_new",
    {
      title: "Save the loaded pedalboard as a new user pedalboard",
      description:
        "Write-gated MOD UI API save step. Requires MOD_DWARF_ENABLE_WRITE_TOOLS=true and confirm=true. Calls POST /pedalboard/save with asNew=1 and never calls /banks/save.",
      inputSchema: {
        title: z.string().min(1),
        confirm: z.boolean(),
        expectedPluginUris: z.array(z.string().min(1)).optional(),
        loadedBundlePath: z.string().min(1).optional()
      }
    },
    async (input) => saveLoadedPedalboardAsNewTool(input, context)
  );

  server.registerTool(
    "load_existing_pedalboard",
    {
      title: "Load an existing saved pedalboard",
      description:
        "Write-gated MOD UI API load step. Requires MOD_DWARF_ENABLE_WRITE_TOOLS=true and confirm=true. Calls POST /pedalboard/load_bundle/ with bundlepath and never calls /pedalboard/save or /banks/save.",
      inputSchema: {
        bundlePath: z.string().min(1),
        confirm: z.boolean()
      }
    },
    async (input) => loadExistingPedalboardTool(input, context)
  );

  server.registerTool(
    "create_pedalboard_dry_bundle",
    {
      title: "Create a local dry-run pedalboard bundle",
      description:
        "Generate manifest.ttl, main TTL, snapshots.json, and addressings.json in a local temporary directory from a dry-run pedalboard plan. Does not upload or call MOD APIs.",
      inputSchema: {
        plan: pedalboardPlanSchema
      }
    },
    async (input) => createPedalboardDryBundleTool(input, context)
  );

  server.registerTool(
    "create_live_graph_authoring_plan",
    {
      title: "Plan live MOD UI graph authoring calls",
      description:
        "Dry-run only: validate a pedalboard plan against installed plugins and LV2 metadata, then return the intended MOD UI HTTP calls without executing them.",
      inputSchema: {
        plan: pedalboardPlanSchema
      }
    },
    async (input) => createLiveGraphAuthoringPlanTool(input, context)
  );

  server.registerTool(
    "run_live_graph_experiment",
    {
      title: "Run a live TinyGain Mono authoring experiment",
      description:
        "Experimental write tool: add TinyGain Mono with /effect/add, verify graph state, then remove it with /effect/remove. Does not save or import anything.",
      inputSchema: {
        confirm: z.literal(true)
      }
    },
    async (input) => runLiveGraphExperimentTool(input, context)
  );

  server.registerTool(
    "run_live_graph_connection_experiment",
    {
      title: "Run a live two-plugin connection experiment",
      description:
        "Experimental write tool: add TinyGain Mono and Bollie Delay, connect them, verify websocket readback, disconnect, and remove both plugins. Does not save or import anything.",
      inputSchema: {
        confirm: z.literal(true)
      }
    },
    async (input) => runLiveGraphConnectionExperimentTool(input, context)
  );
}
