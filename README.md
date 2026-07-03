# mod-dwarf-mcp

Experimental MCP server for the MOD Dwarf pedalboard platform.

This project lets AI agents inspect a connected MOD Dwarf, discover installed LV2 plugins, create structured pedalboard recipes, apply live graph changes, save pedalboards, and perform guarded surgical edits such as adding, removing, replacing, or tweaking effects.

> [!WARNING]
> **Alpha software. Tested primarily on one MOD Dwarf running firmware v1.13.5.3315.**
>
> Write tools can modify the connected device. They are disabled by default and require both `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and `confirm=true` in tool input. Back up important pedalboards before enabling writes.

This is an unofficial community project. It is not affiliated with or endorsed by MOD Audio.

---

## Status

Current status: **public alpha / experimental**.

What works today:

- Read MOD Dwarf device info, banks, pedalboards, snapshots, and installed plugins.
- Build recipe-driven pedalboards from structured `EffectRecipe` input.
- Apply and save new pedalboards through MOD UI HTTP endpoints.
- Search installed plugins and inspect exact LV2 parameter symbols/ranges.
- Perform guarded surgical edits: add, remove, replace, parameter set, duplicate, snapshot activation.
- Validate audio paths and remove orphan effects after graph edits.
- Detect firmware support for bypass before attempting bypass toggles.

Known limitations:

- The MCP is not a tone-research engine. The user-facing AI must decide the musical intent and provide an explicit recipe.
- Bypass support depends on firmware. Call `check_bypass_support` before `toggle_effect_bypass`.
- Snapshot-level effect on/off is not guaranteed on all firmware. Parameter fallback may be needed.
- MIDI-controller and instrument-plugin workflows are not the primary supported path yet; the current graph builder is audio-chain oriented.
- Always inspect `afterState` after write tools.

---

## Architecture: Who Does What

**This MCP server is not the musical intelligence layer. It is the execution and translation layer.**

```text
User prompt
  -> User-facing AI agent
       -> interprets musical intent
       -> researches the target tone when needed
       -> decides effects, plugin choices, settings, snapshots, and sections
       -> looks up installed plugins via list_plugins / search_plugins
       -> produces a structured EffectRecipe
            -> MCP server
                 -> validates the recipe shape
                 -> maps effect roles to installed plugins
                 -> generates a PedalboardPlan
                 -> applies and saves to the MOD Dwarf
                 -> reports what happened
```

The MCP is the **hand** that operates the MOD Dwarf. The user's AI agent is the **brain** that decides what to play.

### What the MCP does NOT do

- It does not know how Nirvana, Tame Impala, U2, or any artist sounds.
- It does not decide which effects a song needs.
- It does not replace the user's AI model as the musical reasoning layer.
- It does not invent musical intent when the `EffectRecipe` is explicit.
- It should not be expected to autonomously research tone or style.

Any song-specific logic currently present in the codebase is a compatibility shim, not the intended long-term design. The right design is: **the AI agent decides, the MCP executes.**

---

## Recommended Workflow

1. `check_inventory_status`
2. If missing or stale: `refresh_device_inventory`
3. `list_plugins` or `search_plugins`
4. `get_plugin_parameters` for any plugin whose parameters you want to set
5. User-facing AI builds an explicit `EffectRecipe`
6. `create_pedalboard_from_recipe`
7. Inspect the result and verify `afterState` / saved board state

For the full AI-agent workflow, see [`docs/MCP_MANUAL.md`](docs/MCP_MANUAL.md).
For per-tool input/output schemas, see [`docs/TOOL_REFERENCE.md`](docs/TOOL_REFERENCE.md).
If the Codex tool list looks truncated or stale, see [`docs/TROUBLESHOOTING_MCP_DISCOVERY.md`](docs/TROUBLESHOOTING_MCP_DISCOVERY.md).

---

## Example EffectRecipe

This example uses plugin names and URIs that are expected in the current fallback catalog. For a real device, always call `list_plugins` or `search_plugins` first and use the exact URI returned by the device inventory.

```json
{
  "song": "Lithium",
  "artist": "Nirvana",
  "instrument": "guitar",
  "operationMode": "new_board",
  "effects": [
    {
      "role": "chorus",
      "character": "clean chorus texture for the intro and verse",
      "intensity": "medium",
      "preferredPluginUri": "http://moddevices.com/plugins/tap/chorusflanger",
      "preferredPluginName": "TAP Chorus/Flanger"
    },
    {
      "role": "distortion",
      "character": "grunge distortion for the loud chorus section",
      "intensity": "strong",
      "preferredPluginUri": "http://moddevices.com/plugins/mod-devel/DS1",
      "preferredPluginName": "DS1"
    }
  ],
  "snapshots": [
    {
      "name": "Intro",
      "description": "Chorus-forward clean intro. If bypass is unsupported, use conservative distortion parameters as fallback.",
      "effectFocus": { "chorus": "on", "distortion": "off or minimal" }
    },
    {
      "name": "Chorus",
      "description": "Chorus plus distortion for the loud section.",
      "effectFocus": { "chorus": "on", "distortion": "strong" }
    }
  ],
  "sections": [
    { "name": "Intro", "snapshot": "Intro" },
    { "name": "Chorus", "snapshot": "Chorus" }
  ]
}
```

The AI agent decided the song interpretation, chain, and snapshots. The MCP validates available plugins, wires the graph, saves the board, and reports the result.

---

## Plugin Semantics

The catalog includes semantic metadata so agents do not confuse plugin types:

- `category`
- `requiresExternalModel`
- `preferredUseCases`
- `avoidForRoles`

Example: **AIDA-X is not a distortion pedal.** It is classified as `amp_and_cab_modeler`, requires an external model, and should be avoided for primary `distortion`, `overdrive`, `fuzz`, or `boost` roles unless explicitly requested.

For distortion-style roles, the fallback preference is dedicated drive/fuzz/distortion plugins first, then modelers only for explicit amp/modeler roles.

---

## Features

Read/discovery tools:

- `get_device_info`
- `check_inventory_status`
- `refresh_device_inventory`
- `list_plugins`
- `search_plugins`
- `get_plugin_parameters`
- `list_pedalboards`
- `inspect_pedalboard`
- `list_banks`
- `list_snapshots`
- `get_current_board_state`

Creation/planning tools:

- `plan_pedalboard_from_prompt`
- `create_pedalboard_from_recipe`
- `create_pedalboard_from_prompt`
- `create_pedalboard_dry_bundle`
- `execute_pedalboard_plan`
- `create_live_graph_authoring_plan`

Surgical edit and maintenance tools:

- `add_effect`
- `remove_effect`
- `replace_effect`
- `set_effect_parameter`
- `toggle_effect_bypass`
- `activate_snapshot`
- `duplicate_pedalboard`
- `validate_current_board_audio_path`
- `remove_orphan_effects`
- `cleanup_snapshot_references`
- `check_bypass_support`

Write/load/save tools:

- `create_new_pedalboard`
- `clear_current_pedalboard`
- `import_pedalboard_dry_bundle`
- `save_loaded_pedalboard_as_new`
- `load_existing_pedalboard`

Experimental tools:

- `run_live_graph_experiment`
- `run_live_graph_connection_experiment`
- `run_live_graph_builder_dry_run_or_apply`
- `run_live_graph_builder_from_prompt`

---

## Requirements

- Node.js 20.10+
- MOD Dwarf reachable from the MCP host
- SSH access to the MOD Dwarf for read-oriented inspection and inventory workflows

---

## Install

```bash
git clone https://github.com/Skydrol/mod-dwarf-mcp.git
cd mod-dwarf-mcp
npm install
cp .env.example .env
```

Edit `.env`:

```env
MOD_DWARF_HOST=moddwarf.local
MOD_DWARF_PORT=80
MOD_DWARF_SSH_USER=root
MOD_DWARF_SSH_PASSWORD=from_env
MOD_DWARF_SSH_TIMEOUT_MS=10000
MOD_DWARF_HTTP_TIMEOUT_MS=10000
MOD_DWARF_ENABLE_WRITE_TOOLS=false
```

Build:

```bash
npm run build
```

Run with stdio MCP transport:

```bash
npm start
```

---

## MCP Client Configuration

### Claude Desktop / compatible MCP clients

After building, add a server entry similar to this:

```json
{
  "mcpServers": {
    "mod-dwarf-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mod-dwarf-mcp/dist/index.js"],
      "env": {
        "MOD_DWARF_HOST": "moddwarf.local",
        "MOD_DWARF_PORT": "80",
        "MOD_DWARF_SSH_USER": "root",
        "MOD_DWARF_SSH_PASSWORD": "your-password",
        "MOD_DWARF_ENABLE_WRITE_TOOLS": "false"
      }
    }
  }
}
```

### Codex

Build the project and register it as a local MCP server in the Codex environment that supports custom MCP servers. If the tool list appears stale after updating the project, see [`docs/TROUBLESHOOTING_MCP_DISCOVERY.md`](docs/TROUBLESHOOTING_MCP_DISCOVERY.md).

---

## Safety Model

Phase 1 is read-only by design. Phase 2 adds planning only. Phase 3A can write generated files only to a local temporary directory on the MCP host. Phase 3B adds write-gated import/load/save tools disabled unless `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and tool input includes `confirm=true`.

Write tools use MOD UI API endpoints and return every API call attempted. They do not fall back to direct filesystem writes for normal write paths.

The SSH client allows only read-oriented commands such as `cat`, `find`, `ls`, `sed -n`, `uname`, `lv2ls`, `test`, `readlink`, `printf`, `grep`, and `wc`. It rejects mutation operations and risky shell syntax.

---

## Development

```bash
npm run dev
npm run build
npm run lint
npm test
npm run format:check
```

Tests use mocks and fixtures only. They do not connect to a real MOD Dwarf.

---

## Project Structure

```text
mod-dwarf-mcp/
├── src/
│   ├── server/
│   ├── tools/
│   ├── services/
│   ├── clients/
│   ├── types/
│   ├── schemas/
│   └── index.ts
├── tests/
├── docs/
├── README.md
├── .env.example
├── package.json
└── tsconfig.json
```

---

## License

MIT. See [`LICENSE`](LICENSE).
