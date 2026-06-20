import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPedalboardDryBundleTool } from "../tools/createPedalboardDryBundle.js";
import { createNewPedalboardTool } from "../tools/createNewPedalboard.js";
import { clearCurrentPedalboardTool } from "../tools/clearCurrentPedalboard.js";
import { refreshDeviceInventoryTool } from "../tools/refreshDeviceInventory.js";
import { createLiveGraphAuthoringPlanTool } from "../tools/createLiveGraphAuthoringPlan.js";
import { createPedalboardFromPromptTool } from "../tools/createPedalboardFromPrompt.js";
import { createPedalboardFromRecipeTool } from "../tools/createPedalboardFromRecipe.js";
import { modifyCurrentBoardTool } from "../tools/modifyCurrentBoard.js";
import { checkInventoryStatusTool } from "../tools/checkInventoryStatus.js";
import { addEffectTool } from "../tools/addEffect.js";
import { removeEffectTool } from "../tools/removeEffect.js";
import { replaceEffectTool } from "../tools/replaceEffect.js";
import { setEffectParameterTool } from "../tools/setEffectParameter.js";
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

// Shared recipe effect schema — kept in one place so both create and modify tools stay in sync.
const effectRecipeEffectSchema = z
  .object({
    role: z.string().min(1),
    character: z.string().min(1),
    intensity: z.enum(["subtle", "medium", "strong"]).optional(),
    preferredPluginUri: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Exact LV2 URI of the plugin to use. This is the most reliable selection method — " +
          "use list_plugins to get URIs. The MCP resolves by URI first before falling back to name or heuristics."
      ),
    preferredPluginName: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Human-readable name hint (e.g. 'Bollie Delay'). Used when preferredPluginUri is not provided."
      ),
    parameters: z
      .record(z.number())
      .optional()
      .describe(
        "Explicit parameter values by LV2 symbol (e.g. { gain: 0.8 }). " +
          "Pinned to a single value, bypassing interpolation."
      )
  })
  .strict();

const effectRecipeSnapshotSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    effectFocus: z.record(z.unknown()),
    parameterValues: z
      .record(z.record(z.number()))
      .optional()
      .describe(
        "Explicit parameter overrides per instance per snapshot, keyed as { instanceName: { symbol: value } }."
      )
  })
  .strict();

const effectRecipeSchema = z
  .object({
    song: z.string().min(1).optional(),
    artist: z.string().min(1).optional(),
    instrument: z.string().min(1),
    operationMode: z.enum([
      "new_board",
      "replace_current_board",
      "modify_current_board",
      "parameter_only"
    ]),
    effects: z.array(effectRecipeEffectSchema).min(1),
    snapshots: z.array(effectRecipeSnapshotSchema).default([]),
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
  })
  .strict();

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
        "MANDATORY FIRST STEP before any pedalboard creation. Scans all LV2 plugins on the device and writes data/deviceInventory.json and data/pluginKnowledgeDb.json. After this runs, list_plugins returns the full device plugin list (200+) instead of the 34-entry fallback catalog. Takes 2–5 minutes on first run; result persists across sessions.",
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
      description: "List installed LV2 plugin names, URIs, or both. Returns all 200+ device plugins when refresh_device_inventory has been run (reads from pluginKnowledgeDb.json). Falls back to the 34-entry hardcoded catalog if the knowledge DB is not yet generated.",
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
        "Convert an explicit EffectRecipe into a pedalboard plan, then execute it through the existing end-to-end HTTP flow. Does not replace the planner or bypass confirm gating. " +
        "Effects support preferredPluginUri (most reliable — use list_plugins to get URIs), preferredPluginName (name hint), and parameters (explicit LV2 symbol→value map). " +
        "Snapshots support parameterValues for per-snapshot overrides.",
      inputSchema: {
        recipe: effectRecipeSchema,
        confirm: z.boolean(),
        title: z.string().min(1).optional()
      }
    },
    async (input) => createPedalboardFromRecipeTool(input, context)
  );

  server.registerTool(
    "modify_current_board",
    {
      title: "Modify an existing pedalboard in-place",
      description:
        "Write-gated in-place modifier. Loads the specified bundle, resets the live graph, applies the new recipe, and saves back to the same bundlepath (asNew=0). Use when the user wants to change effects or parameters on an existing pedalboard without creating a new one. Requires bundlepath (from list_pedalboards or inspect_pedalboard), an EffectRecipe describing the complete desired final state, and confirm=true. " +
        "For smaller changes (add one effect, tweak a knob, swap one plugin), prefer the surgical tools: add_effect, remove_effect, replace_effect, set_effect_parameter.",
      inputSchema: {
        bundlepath: z.string().min(1),
        recipe: effectRecipeSchema,
        confirm: z.boolean(),
        title: z.string().min(1).optional()
      }
    },
    async (input) => modifyCurrentBoardTool(input, context)
  );

  server.registerTool(
    "check_inventory_status",
    {
      title: "Check plugin inventory status",
      description:
        "Check whether the plugin knowledge database exists, how many plugins it contains, and how old it is. " +
        "Call this FIRST in any new session before creating pedalboards. " +
        "If exists=false or isStale=true, run refresh_device_inventory before proceeding. " +
        "Returns: exists, pluginCount, generatedAt, ageHours, isStale, message.",
      inputSchema: {}
    },
    async (input) => checkInventoryStatusTool(input, context)
  );

  server.registerTool(
    "add_effect",
    {
      title: "Add a single effect plugin to an existing pedalboard",
      description:
        "Surgical insert: adds one plugin to a live pedalboard at the signal chain start or end, rewires connections, and saves in-place. " +
        "Use this instead of rebuilding the entire board when the user says 'add reverb', 'put a boost before the fuzz', etc. " +
        "Requires bundlepath (from list_pedalboards), pluginUri (from list_plugins), position ('first' or 'last'), and confirm=true. " +
        "The plugin must be in the catalog or pluginKnowledgeDb — run check_inventory_status first.",
      inputSchema: {
        bundlepath: z.string().min(1),
        pluginUri: z.string().min(1).describe("Exact LV2 URI — use list_plugins to get it."),
        instanceName: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Instance name slug (e.g. 'MyReverb'). Derived from URI if omitted."
          ),
        position: z.enum(["first", "last"]).default("last"),
        confirm: z.boolean()
      }
    },
    async (input) => addEffectTool(input, context)
  );

  server.registerTool(
    "remove_effect",
    {
      title: "Remove a single effect plugin from an existing pedalboard",
      description:
        "Surgical remove: disconnects, removes, and optionally bypass-reconnects a plugin from a live pedalboard, then saves in-place. " +
        "Use this when the user says 'remove the chorus', 'take out the tremolo', etc. " +
        "Requires bundlepath, instance (from inspect_pedalboard), and confirm=true. " +
        "Set reconnect=true (default) to wire the previous plugin directly to the next one, maintaining signal flow.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instance: z
          .string()
          .min(1)
          .describe("Instance name as seen in inspect_pedalboard (e.g. 'DS1', '/graph/DS1')."),
        reconnect: z.boolean().default(true).describe("Wire prev→next on removal to maintain signal flow."),
        confirm: z.boolean()
      }
    },
    async (input) => removeEffectTool(input, context)
  );

  server.registerTool(
    "replace_effect",
    {
      title: "Replace one effect plugin with another",
      description:
        "Surgical swap: removes a plugin, adds a replacement at the same position, rewires all connections, and saves in-place. " +
        "Use when the user says 'replace the chorus with a flanger', 'swap the fuzz for a Big Muff', etc. " +
        "Requires bundlepath, instanceToReplace (from inspect_pedalboard), newPluginUri (from list_plugins), and confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instanceToReplace: z
          .string()
          .min(1)
          .describe("Instance to remove (e.g. 'DS1'). Use inspect_pedalboard to find names."),
        newPluginUri: z
          .string()
          .min(1)
          .describe("Exact LV2 URI of the replacement plugin — use list_plugins."),
        newInstanceName: z.string().min(1).optional().describe("Optional slug for the new instance."),
        confirm: z.boolean()
      }
    },
    async (input) => replaceEffectTool(input, context)
  );

  server.registerTool(
    "set_effect_parameter",
    {
      title: "Set parameter values on a plugin in an existing pedalboard",
      description:
        "Surgical knob-tweak: sets one or more LV2 parameter values on a specific plugin instance and saves the board in-place. " +
        "Use for 'more shimmer', 'less delay', 'turn up the gain', 'set decay to 0.8'. " +
        "Parameter symbols must be exact LV2 symbols (inspect_pedalboard returns them). " +
        "Requires bundlepath, instance, parameters (object mapping symbol→value), and confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instance: z
          .string()
          .min(1)
          .describe("Instance name from inspect_pedalboard (e.g. 'BollieDelay')."),
        parameters: z
          .record(z.number())
          .describe("LV2 symbol → numeric value, e.g. { \"Decay\": 0.8, \"Mix\": 0.6 }"),
        confirm: z.boolean()
      }
    },
    async (input) => setEffectParameterTool(input, context)
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
