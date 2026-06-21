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
import { getPluginParametersTool } from "../tools/getPluginParameters.js";
import { searchPluginsTool } from "../tools/searchPlugins.js";
import { getCurrentBoardStateTool } from "../tools/getCurrentBoardState.js";
import { toggleEffectBypassTool } from "../tools/toggleEffectBypass.js";
import { activateSnapshotTool } from "../tools/activateSnapshot.js";
import { duplicatePedalboardTool } from "../tools/duplicatePedalboard.js";
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
import { validateAudioPathTool } from "../tools/validateAudioPath.js";
import { removeOrphanEffectsTool } from "../tools/removeOrphanEffects.js";
import { checkBypassSupportTool } from "../tools/checkBypassSupport.js";
import { cleanupSnapshotReferencesTool } from "../tools/cleanupSnapshotReferences.js";
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
        "⚠️ RUN THIS BEFORE FIRST USE and whenever check_inventory_status returns exists=false or isStale=true. " +
        "Scans all LV2 plugins on the device and writes data/pluginKnowledgeDb.json. " +
        "After this runs, list_plugins returns 200+ real device plugins instead of the 34-entry fallback catalog. " +
        "Takes 2–5 minutes on first run; result persists across sessions until firmware changes.",
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
      description:
        "List all installed LV2 plugins (name + URI). Returns 200+ entries when inventory is current. " +
        "Use format='both' to get URI+name pairs for recipe building. " +
        "USE search_plugins instead when you want to find plugins by keyword (e.g. 'shimmer', 'reverb', 'delay').",
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
        "⚠️ MANDATORY FIRST CALL in every session. Call this before anything else — before creating, modifying, or inspecting any pedalboard. " +
        "Returns exists, pluginCount, ageHours, isStale, message. " +
        "If exists=false → run refresh_device_inventory NOW (required before any other tool). " +
        "If isStale=true → run refresh_device_inventory before creating or modifying boards. " +
        "Without a current inventory, only 34 hardcoded plugins are visible instead of 200+.",
      inputSchema: {}
    },
    async (input) => checkInventoryStatusTool(input, context)
  );

  server.registerTool(
    "add_effect",
    {
      title: "Add a single effect plugin to an existing pedalboard",
      description:
        "Surgical insert: loads board, adds one plugin, rewires connections, saves in-place. Returns afterState with the updated plugin list and connections so you can verify the result. " +
        "USE WHEN USER SAYS: 'add reverb', 'put a shimmer at the end', 'include a boost before the fuzz', 'adicionar reverb', 'colocar um chorus'. " +
        "DO NOT rebuild the whole board for a single plugin addition — use this tool instead. " +
        "Workflow: 1) search_plugins to find URI, 2) list_pedalboards to get bundlepath, 3) add_effect. " +
        "Requires: bundlepath, pluginUri (from list_plugins/search_plugins), position, confirm=true. " +
        "Position supports: 'first', 'last', 'after:<instance>' (e.g. after:DS1), 'before:<instance>' (e.g. before:Reverb). Instance names from inspect_pedalboard.",
      inputSchema: {
        bundlepath: z.string().min(1),
        pluginUri: z.string().min(1).describe("Exact LV2 URI — use list_plugins or search_plugins."),
        instanceName: z
          .string()
          .min(1)
          .optional()
          .describe("Instance name slug (e.g. 'MyReverb'). Derived from URI if omitted."),
        position: z.string().default("last").describe(
          "Where to insert: 'first' (before first plugin), 'last' (after last plugin), " +
          "'after:<instance>' (e.g. 'after:DS1'), 'before:<instance>' (e.g. 'before:Reverb'). " +
          "Instance names come from inspect_pedalboard."
        ),
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
        "Surgical remove: disconnects, removes, bypass-reconnects, saves in-place. Returns afterState showing the board after removal. " +
        "USE WHEN USER SAYS: 'remove the chorus', 'take out the delay', 'tirar o reverb', 'remover o tremolo', 'delete the distortion'. " +
        "DO NOT use modify_current_board for a single plugin removal — use this tool. " +
        "Workflow: 1) inspect_pedalboard to get exact instance name, 2) remove_effect. " +
        "Requires: bundlepath, instance (exact name from inspect_pedalboard), confirm=true. " +
        "reconnect=true (default) wires the previous plugin to the next, maintaining signal flow.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instance: z
          .string()
          .min(1)
          .describe("Instance name from inspect_pedalboard (e.g. 'DS1', '/graph/DS1')."),
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
        "Surgical swap: remove old plugin, add replacement at same position, rewire all connections, save in-place. Returns afterState with updated plugins and connections. " +
        "USE WHEN USER SAYS: 'swap the reverb for X', 'replace the chorus with a flanger', 'trocar o reverb por outro', 'substituir o DS1 por um Big Muff', 'use X instead of Y', 'change the reverb to shimmer'. " +
        "⚠️ DO NOT load a different pedalboard when asked to swap one effect — use THIS tool. " +
        "⚠️ DO NOT use modify_current_board for a single plugin swap — use THIS tool. " +
        "Workflow: 1) inspect_pedalboard to find instanceToReplace, 2) search_plugins for new URI, 3) replace_effect. " +
        "Requires: bundlepath, instanceToReplace (from inspect_pedalboard), newPluginUri (from list_plugins/search_plugins), confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instanceToReplace: z
          .string()
          .min(1)
          .describe("Instance to remove (from inspect_pedalboard, e.g. 'reverb_3')."),
        newPluginUri: z
          .string()
          .min(1)
          .describe("Exact LV2 URI of the replacement — use list_plugins or search_plugins."),
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
        "Surgical knob-tweak: validates symbols, sets LV2 parameter values on a plugin, saves in-place. Returns afterState so you can verify the change. " +
        "USE WHEN USER SAYS: 'more shimmer', 'less delay', 'turn up the gain', 'set decay to 0.8', 'mais shimmer', 'menos delay', 'aumentar o reverb', 'adjust the mix'. " +
        "⚠️ SYMBOL VALIDATION: If you use a wrong symbol name, the tool returns an error listing ALL valid symbols with ranges and defaults — use those to retry. " +
        "⚠️ NEVER GUESS parameter symbols. Call get_plugin_parameters first if you are unsure what symbols the plugin exposes. " +
        "Workflow: 1) inspect_pedalboard for instance name, 2) get_plugin_parameters for valid symbols, 3) set_effect_parameter. " +
        "Requires: bundlepath, instance (from inspect_pedalboard), parameters ({ symbol: value }), confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instance: z
          .string()
          .min(1)
          .describe("Instance name from inspect_pedalboard (e.g. 'reverb_3')."),
        parameters: z
          .record(z.number())
          .describe(
            "LV2 symbol → numeric value, e.g. { \"dry_level\": 80, \"wet_level\": 40 }. " +
              "Use get_plugin_parameters to find exact symbols for a plugin URI."
          ),
        confirm: z.boolean()
      }
    },
    async (input) => setEffectParameterTool(input, context)
  );

  server.registerTool(
    "get_plugin_parameters",
    {
      title: "Get all parameters of a plugin",
      description:
        "Returns every control input for a plugin: symbol, label, min, max, default, unit. " +
        "USE THIS BEFORE set_effect_parameter to find the exact symbol names — never guess symbols. " +
        "USE WHEN: you need to know what knobs a plugin has, what their valid ranges are, or what symbol to use in set_effect_parameter. " +
        "Input: exact LV2 URI from list_plugins or search_plugins. " +
        "Example: uri='http://moddevices.com/plugins/fomp/DragonflyHallReverb' → returns { symbol: 'dry_level', min: 0, max: 100, default: 80 } and all other controls.",
      inputSchema: {
        uri: z
          .string()
          .min(1)
          .describe("Exact LV2 plugin URI from list_plugins or search_plugins.")
      }
    },
    async (input) => getPluginParametersTool(input, context)
  );

  server.registerTool(
    "search_plugins",
    {
      title: "Search installed plugins by keyword",
      description:
        "Find installed plugins matching a keyword in their name or URI. Case-insensitive. " +
        "USE WHEN: you need to find a plugin by type or name before calling add_effect, replace_effect, or get_plugin_parameters. " +
        "USE WHEN USER SAYS: 'something with shimmer', 'find a chorus', 'what reverbs are installed', 'procurar delay'. " +
        "Returns matching plugin name + URI pairs. Use the URI in subsequent tool calls. " +
        "Examples: query='shimmer', query='dragonfly', query='chorus', query='delay'.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Keyword to search (case-insensitive). Matches name or URI."),
        limit: z
          .number()
          .int()
          .positive()
          .max(100)
          .default(30)
          .describe("Max results (default 30).")
      }
    },
    async (input) => searchPluginsTool(input, context)
  );

  server.registerTool(
    "get_current_board_state",
    {
      title: "Get the currently loaded board state",
      description:
        "Returns the board currently loaded on the MOD Dwarf — plugins, connections, snapshots — without needing to know the bundlepath first. " +
        "USE WHEN USER SAYS: 'what's loaded?', 'what board is active?', 'o que está carregado?', 'show me the current board'. " +
        "Call this at the start of any modification session instead of listing all boards and guessing. " +
        "If the device has no tracking file, returns found=false and suggests using list_pedalboards.",
      inputSchema: {}
    },
    async (input) => getCurrentBoardStateTool(input, context)
  );

  server.registerTool(
    "toggle_effect_bypass",
    {
      title: "Bypass or enable a plugin on an existing pedalboard",
      description:
        "Bypass (disable) or enable a plugin in the live graph. " +
        "USE WHEN USER SAYS: 'bypass the reverb', 'disable the chorus', 'enable the fuzz', 'desativar o delay', 'ativar o reverb'. " +
        "By default, bypass is live only (resets on next board load). Set persist=true to save the bypass state to the bundle permanently. " +
        "Workflow: 1) inspect_pedalboard to find the instance name, 2) toggle_effect_bypass. " +
        "Requires: bundlepath, instance (from inspect_pedalboard), bypassed (true=bypass, false=enable), confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        instance: z
          .string()
          .min(1)
          .describe("Instance name from inspect_pedalboard (e.g. 'reverb_3')."),
        bypassed: z.boolean().describe("true = bypass the effect, false = enable it."),
        persist: z
          .boolean()
          .default(false)
          .describe("Save bypass state to the bundle (persists after reload). Default false = live only."),
        confirm: z.boolean()
      }
    },
    async (input) => toggleEffectBypassTool(input, context)
  );

  server.registerTool(
    "activate_snapshot",
    {
      title: "Activate a named snapshot on a pedalboard",
      description:
        "Load a named snapshot on the currently active board. Snapshots switch between preset configurations (e.g. Clean → Solo → Chorus). " +
        "USE WHEN USER SAYS: 'switch to Solo', 'go to the chorus snapshot', 'activate Clean', 'ir para o snapshot Solo', 'mudar para o preset limpo'. " +
        "Workflow: 1) list_snapshots or inspect_pedalboard to see snapshot names, 2) activate_snapshot. " +
        "Requires: bundlepath, snapshotName (exact name from list_snapshots), confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        snapshotName: z
          .string()
          .min(1)
          .describe("Exact snapshot name from list_snapshots (e.g. 'Solo', 'Clean', 'Verse')."),
        confirm: z.boolean()
      }
    },
    async (input) => activateSnapshotTool(input, context)
  );

  server.registerTool(
    "duplicate_pedalboard",
    {
      title: "Duplicate a pedalboard as a new board",
      description:
        "Create a copy of an existing board under a new title. Preserves all plugins, connections, parameters, snapshots, and addressings. " +
        "USE WHEN USER SAYS: 'make a copy of this board', 'duplicate before modifying', 'save a backup of X', 'criar cópia do pedalboard'. " +
        "Recommended before any significant modification: duplicate first, then edit the copy. " +
        "Workflow: 1) list_pedalboards to get sourceBundlePath, 2) duplicate_pedalboard with new title. " +
        "Requires: sourceBundlePath, newTitle (different from original), confirm=true.",
      inputSchema: {
        sourceBundlePath: z
          .string()
          .min(1)
          .describe("Bundle path of the board to copy (from list_pedalboards)."),
        newTitle: z
          .string()
          .min(1)
          .describe("Title for the duplicate. Must differ from the original."),
        confirm: z.boolean()
      }
    },
    async (input) => duplicatePedalboardTool(input, context)
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

  server.registerTool(
    "validate_current_board_audio_path",
    {
      title: "Validate the audio signal path of a pedalboard",
      description:
        "Inspect the connection graph of a pedalboard bundle and verify that audio flows from " +
        "hardware capture ports through all plugins to playback ports. Reports orphan plugins " +
        "(not connected to the signal path) and whether the chain is complete. " +
        "Call after replace_effect, remove_effect, or add_effect to verify the result. " +
        "USE WHEN: replace_effect returns 0 rewired connections, or when the board sounds silent.",
      inputSchema: {
        bundlepath: z.string().min(1)
      }
    },
    async (input) => validateAudioPathTool(input, context)
  );

  server.registerTool(
    "remove_orphan_effects",
    {
      title: "Remove orphan (disconnected) plugins from a pedalboard",
      description:
        "Write-gated cleanup: detect plugins not connected to the audio path and remove them. " +
        "USE AFTER: replace_effect or remove_effect reports broken connections, or when " +
        "validate_current_board_audio_path returns orphanPlugins.length > 0.",
      inputSchema: {
        bundlepath: z.string().min(1),
        confirm: z.boolean()
      }
    },
    async (input) => removeOrphanEffectsTool(input, context)
  );

  server.registerTool(
    "check_bypass_support",
    {
      title: "Check if the HTTP bypass endpoint is supported on this firmware",
      description:
        "Probe the /effect/bypass HTTP endpoint to determine if toggle_effect_bypass will work. " +
        "Returns supported=true if the endpoint responds (any status other than 404/405), " +
        "supported=false if the endpoint does not exist on this firmware version. " +
        "Call this before toggle_effect_bypass to avoid unexpected failures.",
      inputSchema: {}
    },
    async (input) => checkBypassSupportTool(input, context)
  );

  server.registerTool(
    "cleanup_snapshot_references",
    {
      title: "Remove references to a deleted plugin from snapshots.json",
      description:
        "Write-gated SSH operation: after remove_effect or replace_effect, clean up any " +
        "parameter references to the removed instance in the bundle's snapshots.json file. " +
        "If not called, snapshots may contain stale parameter entries for non-existent plugins. " +
        "Requires: bundlepath, removedInstance (the instance name that was removed), confirm=true.",
      inputSchema: {
        bundlepath: z.string().min(1),
        removedInstance: z.string().min(1).describe("Instance name that was removed (e.g. 'DS1', '/graph/DS1')."),
        confirm: z.boolean()
      }
    },
    async (input) => cleanupSnapshotReferencesTool(input, context)
  );
}
