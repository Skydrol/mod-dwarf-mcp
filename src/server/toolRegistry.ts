import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPedalboardDryBundleTool } from "../tools/createPedalboardDryBundle.js";
import { createNewPedalboardTool } from "../tools/createNewPedalboard.js";
import { clearCurrentPedalboardTool } from "../tools/clearCurrentPedalboard.js";
import { refreshDeviceInventoryTool } from "../tools/refreshDeviceInventory.js";
import { createLiveGraphAuthoringPlanTool } from "../tools/createLiveGraphAuthoringPlan.js";
import { createPedalboardFromPromptTool } from "../tools/createPedalboardFromPrompt.js";
import { createPedalboardFromRecipeTool } from "../tools/createPedalboardFromRecipe.js";
import { runLiveGraphBuilderFromPromptTool } from "../tools/runLiveGraphBuilderFromPrompt.js";
import { runLiveGraphBuilderDryRunOrApplyTool } from "../tools/runLiveGraphBuilderDryRunOrApply.js";
import { runLiveGraphConnectionExperimentTool } from "../tools/runLiveGraphConnectionExperiment.js";
import { runLiveGraphExperimentTool } from "../tools/runLiveGraphExperiment.js";
import { executePedalboardPlanTool } from "../tools/executePedalboardPlan.js";
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
import {
  dryPedalboardBundleSchema,
  liveGraphAuthoringPlanSchema,
  pedalboardPlanSchema
} from "../schemas/tools.js";

export function registerTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "create_new_pedalboard",
    {
      title: "Create a new empty pedalboard",
      description:
        "Write-gated quick path for a fresh empty pedalboard. Calls POST /reset first, then POST /pedalboard/save with asNew=1. It does not load the default board or call /banks/save.",
      inputSchema: {
        title: z.string().min(1),
        confirm: z.boolean()
      }
    },
    async (input) => createNewPedalboardTool(input, context)
  );

  server.registerTool(
    "refresh_device_inventory",
    {
      title: "Refresh device inventory",
      description:
        "Scan the connected MOD Dwarf for device info and installed plugin metadata, regenerate data/deviceInventory.json, and return a summary. No planning, recommendations, or musical enrichment.",
      inputSchema: {}
    },
    async (input) => refreshDeviceInventoryTool(input, context)
  );

  server.registerTool(
    "clear_current_pedalboard",
    {
      title: "Clear the currently loaded pedalboard",
      description:
        "Write-gated MOD UI API clear step. Requires MOD_DWARF_ENABLE_WRITE_TOOLS=true and confirm=true. Removes every plugin currently present in the loaded board using /effect/remove and does not call disconnect, save, or load endpoints.",
      inputSchema: {
        confirm: z.literal(true)
      }
    },
    async (input) => clearCurrentPedalboardTool(input, context)
  );

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
    "run_live_graph_builder_dry_run_or_apply",
    {
      title: "Dry-run or temporarily apply a live graph plan",
      description:
        "Dry-run or apply a temporary live MOD UI stereo chain using UI-compatible /graph instance paths, websocket validation, and automatic rollback. Never saves or calls /banks/save.",
      inputSchema: {
        mode: z.enum(["dry_run", "apply_temporary"]),
        confirm: z.boolean(),
        restoreAfterSeconds: z.number().int().positive().optional(),
        plan: liveGraphAuthoringPlanSchema
      }
    },
    async (input) => runLiveGraphBuilderDryRunOrApplyTool(input, context)
  );

  server.registerTool(
    "run_live_graph_builder_from_prompt",
    {
      title: "Dry-run or temporarily apply a live graph plan from a prompt",
      description:
        "Build a prompt-derived pedalboard plan using real plugin metadata, then apply it as a temporary live MOD UI chain with websocket validation and automatic rollback. Never saves or calls /banks/save.",
      inputSchema: {
        mode: z.enum(["dry_run", "apply_temporary"]),
        confirm: z.boolean(),
        restoreAfterSeconds: z.number().int().positive().optional(),
        plan: pedalboardPlanSchema
      }
    },
    async (input) => runLiveGraphBuilderFromPromptTool(input, context)
  );

  server.registerTool(
    "execute_pedalboard_plan",
    {
      title: "Execute a pedalboard plan end-to-end",
      description:
        "Write-gated end-to-end executor: apply a planner-generated pedalboard plan over HTTP, then save and reload the result as a new pedalboard. Uses only MOD endpoints for write operations.",
      inputSchema: {
        plan: pedalboardPlanSchema,
        confirm: z.boolean(),
        title: z.string().min(1).optional()
      }
    },
    async (input) => executePedalboardPlanTool(input, context)
  );

  server.registerTool(
    "create_pedalboard_from_prompt",
    {
      title: "Create a pedalboard from a prompt",
      description:
        "End-to-end execution path: build a pedalboard plan from the prompt, import the generated bundle via HTTP, save it as a new pedalboard, and emit a final report.",
      inputSchema: {
        plan: pedalboardPlanSchema,
        confirm: z.boolean(),
        title: z.string().min(1).optional()
      }
    },
    async (input) => createPedalboardFromPromptTool(input, context)
  );

  server.registerTool(
    "create_pedalboard_from_recipe",
    {
      title: "Create a pedalboard from a structured recipe",
      description:
        "Convert an explicit EffectRecipe into a pedalboard plan, then execute it through the existing end-to-end HTTP flow. Does not replace the planner or bypass confirm gating.",
      inputSchema: {
        recipe: z.object({
          song: z.string().min(1).optional(),
          artist: z.string().min(1).optional(),
          instrument: z.string().min(1),
          operationMode: z.enum([
            "new_board",
            "replace_current_board",
            "modify_current_board",
            "parameter_only"
          ]),
          effects: z
            .array(
              z
                .object({
                  role: z.string().min(1),
                  character: z.string().min(1),
                  intensity: z.enum(["subtle", "medium", "strong"]).optional()
                })
                .strict()
            )
            .min(1),
          snapshots: z
            .array(
              z
                .object({
                  name: z.string().min(1),
                  description: z.string().min(1),
                  effectFocus: z.record(z.unknown())
                })
                .strict()
            )
            .default([]),
          sections: z
            .array(
              z
                .object({
                  name: z.string().min(1),
                  snapshot: z.string().min(1)
                })
                .strict()
            )
            .default([])
        }).strict(),
        confirm: z.boolean(),
        title: z.string().min(1).optional()
      }
    },
    async (input) => createPedalboardFromRecipeTool(input, context)
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
