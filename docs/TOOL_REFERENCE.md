# MOD Dwarf MCP — Tool Reference

All 34 tools, documented with inputs, outputs, and usage notes.

**Write-gated tools** require `MOD_DWARF_ENABLE_WRITE_TOOLS=true` in the environment **and** `confirm: true` in the call. Passing `confirm: false` returns the validation result without executing.

---

## Contents

- [Inventory & Device](#inventory--device)
- [Plugin Discovery](#plugin-discovery)
- [Board Discovery](#board-discovery)
- [Pedalboard Creation & Modification](#pedalboard-creation--modification)
- [Surgical Edits](#surgical-edits)
- [Board Management](#board-management)
- [Experimental / Low-Level](#experimental--low-level)

---

## Inventory & Device

### `check_inventory_status`

**Type:** Read (no write, no SSH, instant)

Check whether the local plugin knowledge database is present and fresh. **Call this first in every session.**

#### Input

No fields.

#### Output

```jsonc
{
  "exists": true,          // false if refresh_device_inventory has never run
  "pluginCount": 247,      // 0 when exists=false
  "generatedAt": "2025-12-01T10:00:00.000Z",
  "ageHours": 12.5,        // null when exists=false
  "isStale": false,        // true after 72 h
  "message": "Inventory is current: 247 plugins indexed, generated 12.5h ago."
}
```

**Next step:**
- `exists=false` → run `refresh_device_inventory` immediately (required before any other tool)
- `isStale=true` → run `refresh_device_inventory` before creating or modifying boards
- otherwise → proceed

---

### `refresh_device_inventory`

**Type:** Write-gated (SSH + local write)

SSH into the device, scan all LV2 plugins with `lv2ls` + `lv2info`, and write `data/pluginKnowledgeDb.json`. After this runs, `list_plugins` returns 200+ real device plugins instead of the 34-entry built-in fallback catalog. Takes 2–5 minutes on first run; persists across sessions until firmware changes.

#### Input

No fields.

#### Output

```jsonc
{
  "pluginCount": 247,
  "newInventoryWritten": true,
  "inventoryPath": "/abs/path/to/data/deviceInventory.json",
  "knowledgeDbPath": "/abs/path/to/data/pluginKnowledgeDb.json",
  "knowledgeDbWritten": true
}
```

---

### `get_device_info`

**Type:** Read (SSH)

Read firmware version, OS details, kernel, architecture, and counts of LV2 plugins and pedalboards.

#### Input

No fields.

#### Output

```jsonc
{
  "firmwareVersion": "1.13.5.3315",
  "controllerVersion": "1.13.5.3315",
  "os": { "name": "Linux", "version": "4.19.125" },
  "kernel": "4.19.125 #1 PREEMPT",
  "architecture": "armv7l",
  "counts": {
    "lv2Plugins": 247,
    "userPedalboards": 12,
    "factoryPedalboards": 30,
    "userLv2Bundles": 0,
    "systemLv2Bundles": 0
  }
}
```

---

## Plugin Discovery

### `list_plugins`

**Type:** Read (local DB)

List all installed LV2 plugins. Returns 200+ entries when inventory is current. Prefer `search_plugins` when looking for a specific type.

#### Input

| Field | Type | Default | Description |
|---|---|---|---|
| `format` | `"names"` \| `"uris"` \| `"both"` | `"both"` | What to include in each entry. Use `"both"` for recipe building. |

#### Output

```jsonc
{
  "count": 247,
  "plugins": [
    { "name": "Dragonfly Hall Reverb", "uri": "http://moddevices.com/plugins/..." },
    { "name": "Bollie Delay",          "uri": "http://moddevices.com/plugins/..." }
    // ... up to 247 entries
  ]
}
```

With `format="names"` each entry has only `name`; with `format="uris"` only `uri`.

---

### `search_plugins`

**Type:** Read (local DB)

Case-insensitive keyword search across plugin names and URIs. Faster than filtering `list_plugins` manually.

#### Input

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | required | Keyword (e.g. `"shimmer"`, `"reverb"`, `"dragonfly"`). |
| `limit` | `integer 1–100` | `30` | Max results. |

#### Output

Same shape as `list_plugins`:

```jsonc
{
  "count": 3,
  "plugins": [
    { "name": "Dragonfly Hall Reverb",  "uri": "http://..." },
    { "name": "Dragonfly Room Reverb",  "uri": "http://..." },
    { "name": "Dragonfly Plate Reverb", "uri": "http://..." }
  ]
}
```

---

### `get_plugin_parameters`

**Type:** Read (SSH or local catalog)

Return all control inputs for a plugin: LV2 symbol, label, min, max, default, unit. **Call this before `set_effect_parameter` if you don't know the exact symbol names.** Never guess symbols.

#### Input

| Field | Type | Description |
|---|---|---|
| `uri` | `string` | Exact LV2 URI from `list_plugins` or `search_plugins`. |

#### Output

```jsonc
{
  "uri": "http://moddevices.com/plugins/fomp/DragonflyHallReverb",
  "ports": [ /* all ports (audio, control, atom) */ ],
  "audioInputs":   [ { "index": 0, "symbol": "Input_L",   "kind": "audio",   "direction": "input"  } ],
  "audioOutputs":  [ { "index": 2, "symbol": "Output_L",  "kind": "audio",   "direction": "output" } ],
  "controlInputs": [
    {
      "index": 4, "symbol": "dry_level", "name": "Dry Level",
      "kind": "control", "direction": "input",
      "default": 80, "minimum": 0, "maximum": 100, "unit": "%",
      "properties": []
    }
    // ... all knobs/controls
  ]
}
```

---

## Board Discovery

### `get_current_board_state`

**Type:** Read (SSH)

Return the board currently loaded on the device — plugins, connections, snapshots — without needing the bundle path first. Uses the device's tracking file; falls back to the `current` symlink.

#### Input

No fields.

#### Output (found)

```jsonc
{
  "found": true,
  "currentBoardPath": "/root/.pedalboards/My Board.pedalboard",
  "title": "My Board",
  "source": "user",
  "pluginsUsed": [
    { "instance": "DS1",   "uri": "http://..." },
    { "instance": "Reverb","uri": "http://..." }
  ],
  "connections": [
    { "tail": "/graph/capture_1",     "head": "/graph/DS1/In"       },
    { "tail": "/graph/DS1/Out",       "head": "/graph/Reverb/Input" },
    { "tail": "/graph/Reverb/Output", "head": "/graph/playback_1"   }
  ],
  "snapshots": [ { "name": "Clean", "plugins": ["DS1", "Reverb"], "portsByPlugin": {} } ],
  "files": { "manifest": "...", "mainTtl": "...", "snapshots": "...", "addressings": "..." }
}
```

#### Output (not found)

```jsonc
{
  "found": false,
  "message": "No current-board tracking file found on this firmware. Use list_pedalboards instead.",
  "currentBoardPath": null,
  "inspection": null
}
```

---

### `list_pedalboards`

**Type:** Read (SSH)

List user and/or factory pedalboard bundles present on the device.

#### Input

| Field | Type | Default | Description |
|---|---|---|---|
| `source` | `"user"` \| `"factory"` \| `"all"` | `"all"` | Which boards to include. |

#### Output

```jsonc
{
  "user": [
    {
      "title": "My Board",
      "bundlePath": "/root/.pedalboards/My Board.pedalboard",
      "source": "user",
      "hasManifest": true, "hasSnapshots": true, "hasPresets": false, "hasAddressings": true
    }
  ],
  "factory": [ /* same shape */ ]
}
```

---

### `inspect_pedalboard`

**Type:** Read (SSH)

Full inspection of one pedalboard bundle: all plugins, all connections, mappings, snapshot details, and file list. Use this to get exact instance names before calling surgical edit tools.

#### Input

| Field | Type | Description |
|---|---|---|
| `bundlePath` | `string` | Bundle path from `list_pedalboards` (e.g. `/root/.pedalboards/My Board.pedalboard`). |

#### Output

```jsonc
{
  "bundlePath": "/root/.pedalboards/My Board.pedalboard",
  "title": "My Board",
  "source": "user",
  "files": {
    "manifest": "manifest.ttl", "mainTtl": "My Board.ttl",
    "addressings": "addressings.json", "snapshots": "snapshots.json",
    "presets": null, "thumbnail": null, "screenshot": null
  },
  "pluginsUsed": [
    { "instance": "DS1",   "uri": "http://..." },
    { "instance": "Reverb","uri": "http://..." }
  ],
  "connections": [
    { "tail": "/graph/capture_1",  "head": "/graph/DS1/In"        },
    { "tail": "/graph/DS1/Out",    "head": "/graph/Reverb/Input"  },
    { "tail": "/graph/Reverb/Out", "head": "/graph/playback_1"    }
  ],
  "mappings": null,
  "snapshots": [
    {
      "name": "Clean",
      "plugins": ["DS1", "Reverb"],
      "portsByPlugin": { "DS1": { "gain": 0.5 } },
      "parametersByPlugin": {}
    }
  ],
  "metadata": { "format": "lv2-bundle", "ttlBased": true, "jsonSidecars": ["snapshots.json"] }
}
```

---

### `list_snapshots`

**Type:** Read (SSH)

List snapshots for a specific pedalboard bundle. Snapshots are named presets that switch parameter values across all plugins at once.

#### Input

| Field | Type | Description |
|---|---|---|
| `bundlePath` | `string` | Bundle path from `list_pedalboards`. |

#### Output

```jsonc
{
  "bundlePath": "/root/.pedalboards/My Board.pedalboard",
  "sourceFile": "snapshots.json",
  "current": 0,
  "snapshots": [
    {
      "name": "Clean",
      "plugins": ["DS1", "Reverb"],
      "portsByPlugin": { "DS1": { "gain": 0.3 }, "Reverb": { "wet_level": 0.5 } },
      "parametersByPlugin": {}
    },
    {
      "name": "Solo",
      "plugins": ["DS1", "Reverb"],
      "portsByPlugin": { "DS1": { "gain": 0.9 }, "Reverb": { "wet_level": 0.8 } },
      "parametersByPlugin": {}
    }
  ]
}
```

---

### `list_banks`

**Type:** Read (SSH)

List bank entries (ordered pedalboard collections) from the device.

#### Input

| Field | Type | Default | Description |
|---|---|---|---|
| `source` | `"user"` \| `"factory"` \| `"all"` | `"all"` | Which banks to include. |

#### Output

```jsonc
{
  "user": [
    {
      "title": "Live Set A",
      "pedalboards": [
        { "title": "Clean Tones",  "bundle": "/root/.pedalboards/Clean Tones.pedalboard" },
        { "title": "Heavy Riffs",  "bundle": "/root/.pedalboards/Heavy Riffs.pedalboard" }
      ]
    }
  ],
  "factory": [ /* same shape */ ]
}
```

---

## Pedalboard Creation & Modification

### `create_pedalboard_from_recipe`

**Type:** Write-gated (HTTP + SSH)

**Recommended entry point for AI agent–driven creation.** Convert a structured `EffectRecipe` into a pedalboard plan, execute it through the live HTTP graph, and save it as a new board.

The AI agent decides the effects, parameters, and snapshots. This tool validates, translates, applies, and saves.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `recipe` | `EffectRecipe` | yes | See schema below. |
| `confirm` | `boolean` | yes | `false` = dry-run validation only; `true` = execute and save. |
| `title` | `string` | no | Board title override. Derived from `recipe.artist + recipe.song` if omitted. |

**`EffectRecipe` schema:**

```jsonc
{
  "song": "Elephant",                   // optional
  "artist": "Tame Impala",             // optional
  "instrument": "guitar",              // required
  "operationMode": "new_board",        // "new_board" | "replace_current_board" | "modify_current_board" | "parameter_only"
  "effects": [
    {
      "role": "fuzz",                  // required — descriptive label
      "character": "thick, gated fuzz",// required — helps heuristic matching
      "intensity": "strong",           // optional — "subtle" | "medium" | "strong"
      "preferredPluginUri": "http://moddevices.com/plugins/mod-devel/BigMuff", // optional but recommended
      "preferredPluginName": "Open Big Muff",                                  // optional fallback
      "parameters": { "sustain": 0.85, "tone": 0.45 }                         // optional — LV2 symbol→value
    }
  ],
  "snapshots": [
    {
      "name": "Verse",                 // required
      "description": "Fuzz on, phaser subtle", // required
      "effectFocus": { "fuzz": "strong", "phaser": "subtle" }, // required
      "parameterValues": {             // optional — per-snapshot overrides
        "BigMuff": { "sustain": 0.7 }
      }
    }
  ],
  "sections": [                        // optional
    { "name": "Verse", "snapshot": "Verse" }
  ]
}
```

#### Output → `ExecutePedalboardPlanResult`

```jsonc
{
  "confirmed": true,
  "operationMode": "new_board",
  "title": "Tame Impala - Elephant",
  "imported": true,    // live graph was built
  "saved": true,       // /pedalboard/save succeeded
  "loaded": true,      // board is now active
  "reportPath": null,
  "apiCalls": [
    { "method": "GET", "path": "/reset", "purpose": "Clear live graph", "status": "success", "httpStatus": 200 },
    { "method": "GET", "path": "/effect/add//graph/BigMuff?...", "purpose": "Add plugin", "status": "success" }
    // ... one entry per API call
  ],
  "notes": ["Board saved as 'Tame Impala - Elephant'"]
}
```

---

### `create_pedalboard_from_prompt`

**Type:** Write-gated (HTTP + SSH)

Build a pedalboard plan from a structured prompt object and execute it end-to-end. Lower-level than `create_pedalboard_from_recipe` — accepts a `PedalboardPlan` directly instead of an `EffectRecipe`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | `PedalboardPlan` | yes | Full pedalboard plan (output of `plan_pedalboard_from_prompt`). |
| `confirm` | `boolean` | yes | `false` = dry-run; `true` = execute and save. |
| `title` | `string` | no | Override the plan's derived title. |

#### Output

Same as `create_pedalboard_from_recipe` → `ExecutePedalboardPlanResult`.

---

### `modify_current_board`

**Type:** Write-gated (HTTP + SSH)

In-place modifier: loads the specified bundle, resets the live graph, applies a new `EffectRecipe`, and saves back to the **same bundle path** (`asNew=0`). Use when the user wants to change the complete effect chain of an existing board without creating a new one.

For smaller changes (add/remove/swap one effect, tweak a knob), prefer the surgical tools.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path of the board to modify (from `list_pedalboards`). |
| `recipe` | `EffectRecipe` | yes | Describes the **complete desired final state** of the board. |
| `confirm` | `boolean` | yes | `false` = dry-run; `true` = execute and overwrite. |
| `title` | `string` | no | Rename the board while modifying. |

#### Output

Same as `create_pedalboard_from_recipe` → `ExecutePedalboardPlanResult`.

---

### `plan_pedalboard_from_prompt`

**Type:** Dry-run (read-only)

Inspect installed plugins and existing templates, then propose a signal chain, plugin choices, and snapshot structure — **without writing anything**. Returns a `PedalboardPlan` that can be passed directly to `execute_pedalboard_plan` or `create_pedalboard_from_prompt`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `style` | `string` | yes | Tone description (e.g. `"heavy blues rock"`). |
| `instrument` | `string` | yes | e.g. `"guitar"`, `"bass"`. |
| `goals` | `string[]` | yes | List of effect/tone goals (e.g. `["warm overdrive", "slapback delay"]`). |
| `referenceArtists` | `string[]` | no | Hints for plugin selection (e.g. `["SRV", "Hendrix"]`). |

#### Output → `PedalboardPlan`

```jsonc
{
  "dryRun": true,
  "operationMode": "new_board",
  "safety": { "writesFiles": false, "modifiesDevice": false, "callsPostEndpoints": false },
  "request": { "style": "heavy blues rock", "instrument": "guitar", "goals": ["..."] },
  "template": null,
  "availablePluginCount": 247,
  "signalChain": [
    {
      "role": "overdrive",
      "name": "Calf Vintage Delay",  // actual installed plugin chosen
      "uri": "http://...",
      "reason": "Matched 'warm overdrive' — tube-like saturation",
      "suggestedInstance": "Overdrive",
      "parameterRanges": { "drive": { "min": 0, "max": 1, "unit": "" } }
    }
  ],
  "snapshots": [
    {
      "name": "Clean",
      "description": "Dry signal",
      "parameterFocus": { "overdrive": "min drive" },
      "parameterValues": { "Overdrive": { "drive": 0.1 } }
    }
  ],
  "notes": ["Template not found — built from scratch"],
  "unsupportedIdeas": []
}
```

---

### `execute_pedalboard_plan`

**Type:** Write-gated (HTTP + SSH)

Execute a `PedalboardPlan` end-to-end: apply the plan over the live HTTP graph, save and reload as a new board. Usually called with the output of `plan_pedalboard_from_prompt` or `create_live_graph_authoring_plan`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | `PedalboardPlan` | yes | A complete pedalboard plan. |
| `confirm` | `boolean` | yes | `false` = dry-run; `true` = execute and save. |
| `title` | `string` | no | Override the plan title. |

#### Output

Same as `create_pedalboard_from_recipe` → `ExecutePedalboardPlanResult`.

---

### `create_new_pedalboard`

**Type:** Write-gated (HTTP)

Quick path for a fresh **empty** pedalboard. Calls `/reset` then saves with `asNew=1`. Does not add any plugins.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes | Name for the new empty board. |
| `confirm` | `boolean` | yes | Must be `true` to execute. |

#### Output → `CreateNewPedalboardResult`

```jsonc
{
  "writeToolsEnabled": true,
  "confirmed": true,
  "title": "My New Board",
  "operationMode": "new_board",
  "reset": { "attempted": true, "success": true, "endpoint": "/reset", "httpStatus": 200, "body": "true" },
  "saved": { "attempted": true, "success": true, "endpoint": "/pedalboard/save", "httpStatus": 200, "body": "true" },
  "apiCalls": [ /* call log */ ],
  "directFileWrites": false,
  "notes": []
}
```

---

### `create_pedalboard_dry_bundle`

**Type:** Dry-run (local only — no device calls)

Generate the full LV2 bundle files (`manifest.ttl`, main TTL, `snapshots.json`, `addressings.json`) in a local temp directory from a `PedalboardPlan`. Nothing is sent to the device. Useful to inspect what would be created before executing.

#### Input

| Field | Type | Description |
|---|---|---|
| `plan` | `PedalboardPlan` | The plan to serialize (output of `plan_pedalboard_from_prompt`). |

#### Output → `DryPedalboardBundle`

```jsonc
{
  "dryRun": true,
  "sourcePlan": { /* the input plan */ },
  "directoryPath": "/tmp/mod-dwarf-mcp-dry/My Board/",
  "bundlePath":   "/tmp/mod-dwarf-mcp-dry/My Board/My Board.pedalboard",
  "generatedFiles": {
    "manifest": "manifest.ttl contents...",
    "mainTtl":  "My Board.ttl contents...",
    "snapshots": "{...}",
    "addressings": "{}"
  },
  "validation": {
    "pluginUris": { "valid": true, "checked": ["http://..."], "missing": [] },
    "snapshots":  { "valid": true, "errors": [], "snapshotCount": 2 },
    "ttl": {
      "valid": true, "errors": [],
      "manifestReferencesMainTtl": true, "mainTtlHasPedalboardName": true,
      "pluginBlockCount": 3, "connectionCount": 4, "followsTemplateStructure": true
    },
    "dryRun": { "localOnly": true, "uploadedToDevice": false, "calledModApi": false, "modifiedPedalboards": false }
  }
}
```

---

### `import_pedalboard_dry_bundle`

**Type:** Write-gated (HTTP)

Upload a dry bundle (output of `create_pedalboard_dry_bundle`) to the device via `POST /pedalboard/load_web/`. Activates the board and saves it as a new user pedalboard.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `dryBundle` | `DryPedalboardBundle` | yes | Output of `create_pedalboard_dry_bundle`. |
| `confirm` | `boolean` | yes | `false` = validate only; `true` = upload and save. |
| `targetName` | `string` | no | Override the bundle directory name. |

#### Output → `ImportDryBundleResult`

```jsonc
{
  "writeToolsEnabled": true,
  "confirmed": true,
  "dryRunSourceVerified": true,
  "targetName": "My Board",
  "targetExists": false,
  "backup": { "required": false, "created": false },
  "import": { "attempted": true, "success": true, "endpoint": "POST /pedalboard/load_web/" },
  "localArchivePath": "/tmp/mod-dwarf-mcp-dry/My Board.tar.gz",
  "loadedGraphValidation": {
    "attempted": true, "success": true,
    "bundlePath": "/tmp/pedalboards/My Board",
    "pluginCount": 3,
    "expectedPluginUris": ["http://..."],
    "actualPluginUris": ["http://..."],
    "missingPluginUris": []
  },
  "apiCalls": [ /* call log */ ],
  "directFileWrites": false,
  "notes": []
}
```

---

### `duplicate_pedalboard`

**Type:** Write-gated (SSH + HTTP)

Create a copy of an existing pedalboard under a new title. Preserves all plugins, connections, parameters, snapshots, and addressings. Recommended before any significant modification.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `sourceBundlePath` | `string` | yes | Bundle path of the board to copy (from `list_pedalboards`). |
| `newTitle` | `string` | yes | Title for the duplicate (must differ from original). |
| `confirm` | `boolean` | yes | `false` = dry-run; `true` = execute. |

#### Output → `DuplicateBoardResult`

```jsonc
{
  "success": true,
  "notes": ["Duplicated 'My Board' as 'My Board (copy)'"],
  "newTitle": "My Board (copy)",
  "newBundlePath": "/root/.pedalboards/My Board (copy).pedalboard",
  "apiCalls": [
    { "path": "POST /pedalboard/load_web/", "status": "success" },
    { "path": "GET /pedalboard/save?asNew=1&title=My+Board+(copy)", "status": "success" }
  ]
}
```

---

## Surgical Edits

All surgical edit tools require `bundlepath` (from `list_pedalboards`) and `confirm: true`. They all return `afterState` — a full `PedalboardInspection` of the board after the change — so the result can be verified immediately.

### `add_effect`

Add a single plugin to an existing pedalboard. Loads the board, inserts the plugin at the specified position, rewires the signal chain, and saves in-place.

Workflow: `search_plugins` (find URI) → `list_pedalboards` (get bundlepath) → `add_effect`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path from `list_pedalboards`. |
| `pluginUri` | `string` | yes | Exact LV2 URI from `list_plugins` or `search_plugins`. |
| `instanceName` | `string` | no | Instance name slug (e.g. `"MyReverb"`). Derived from URI if omitted. |
| `position` | `string` | no (default `"last"`) | `"first"`, `"last"`, `"after:<instance>"`, or `"before:<instance>"`. Instance names from `inspect_pedalboard`. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `GraphEditResult`

```jsonc
{
  "success": true,
  "notes": ["Added 'Dragonfly Hall Reverb' at position last"],
  "apiCalls": [
    { "path": "/effect/add//graph/Reverb?...", "status": "success", "httpStatus": 200 }
  ],
  "afterState": { /* full PedalboardInspection */ }
}
```

---

### `remove_effect`

Remove a single plugin from an existing pedalboard. Disconnects it, removes it, and optionally rewires the gap in the signal chain.

Workflow: `inspect_pedalboard` (get exact instance name) → `remove_effect`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `instance` | `string` | yes | Exact instance name from `inspect_pedalboard` (e.g. `"DS1"`, `"/graph/DS1"`). |
| `reconnect` | `boolean` | no (default `true`) | Wire the previous plugin to the next, maintaining signal flow. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `GraphEditResult`

Same shape as `add_effect`.

---

### `replace_effect`

Swap one plugin for another at the same position in the signal chain. Remove the old instance, add the replacement, rewire all connections, and save in-place.

Workflow: `inspect_pedalboard` (find `instanceToReplace`) → `search_plugins` (find `newPluginUri`) → `replace_effect`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `instanceToReplace` | `string` | yes | Instance to remove (from `inspect_pedalboard`). |
| `newPluginUri` | `string` | yes | LV2 URI of the replacement plugin. |
| `newInstanceName` | `string` | no | Optional slug for the new instance. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `GraphEditResult`

Same shape as `add_effect`, with additional rewire counts in `notes`.

**⚠️ Critical:** If the replaced plugin had incoming or outgoing connections but `success=false` is returned, zero connections were rewired — the audio path is broken. The new plugin is present in the graph but disconnected. Immediately call `validate_current_board_audio_path` to assess the state and `remove_orphan_effects` to clean up, then re-insert with `add_effect` using a positional argument.

```jsonc
{
  "success": false,
  "notes": ["AUDIO PATH BROKEN: plugin had connections but 0 were rewired. Run validate_current_board_audio_path."],
  "apiCalls": [ /* ... */ ],
  "afterState": { /* ... */ }
}
```

---

### `set_effect_parameter`

Set one or more LV2 parameter values on a plugin in an existing pedalboard. Validates symbols before applying; on error returns all valid symbols with ranges so you can retry.

Workflow: `inspect_pedalboard` (instance name) → `get_plugin_parameters` (valid symbols) → `set_effect_parameter`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `instance` | `string` | yes | Instance name from `inspect_pedalboard` (e.g. `"reverb_3"`). |
| `parameters` | `Record<string, number>` | yes | LV2 symbol → value (e.g. `{ "dry_level": 80, "wet_level": 40 }`). |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `GraphEditResult`

Same shape as `add_effect`. On symbol error, `success: false` and `notes` lists all valid symbols with their min/max/default.

---

### `toggle_effect_bypass`

Bypass (disable) or enable a plugin in the live graph. By default, the bypass state is live only (resets on next board load). Set `persist: true` to save it into the bundle.

> **⚠️ Firmware limitation:** On MOD Dwarf firmware v1.13.5.3315 and similar, the `/effect/bypass` HTTP endpoint returns 404. `toggle_effect_bypass` will return `unsupported=true` on these versions. Call `check_bypass_support` before relying on this tool. Do NOT simulate bypass by zeroing parameters — that is not real bypass.

Workflow: `check_bypass_support` (one-time per session) → `inspect_pedalboard` (instance name) → `toggle_effect_bypass`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `instance` | `string` | yes | Instance name from `inspect_pedalboard`. |
| `bypassed` | `boolean` | yes | `true` = bypass the effect; `false` = enable it. |
| `persist` | `boolean` | no (default `false`) | Save bypass state permanently to the bundle. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `BypassResult`

**Success case:**
```jsonc
{
  "success": true,
  "notes": ["Bypass set on reverb_3 (live only)"],
  "instance": "reverb_3",
  "bypassed": true,
  "persisted": false,
  "unsupported": false,
  "afterState": { /* full PedalboardInspection */ }
}
```

**Unsupported firmware case:**
```jsonc
{
  "success": false,
  "unsupported": true,
  "notes": [
    "Bypass endpoint not supported on this firmware (HTTP 404).",
    "Alternatives: (1) activate_snapshot to switch between snapshots with/without this effect; (2) remove_effect to permanently remove it."
  ],
  "instance": "reverb_3",
  "bypassed": false,
  "persisted": false,
  "afterState": null
}
```

---

### `activate_snapshot`

Load a named snapshot on the currently active board. Snapshots switch between preset configurations (e.g. Clean → Solo → Chorus).

Workflow: `list_snapshots` (see names) → `activate_snapshot`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `snapshotName` | `string` | yes | Exact snapshot name from `list_snapshots` (e.g. `"Solo"`, `"Clean"`). Case-insensitive matching. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `SnapshotActivateResult`

```jsonc
{
  "success": true,
  "notes": ["Snapshot 'Solo' activated"],
  "snapshotName": "Solo",
  "afterState": { /* full PedalboardInspection */ }
}
```

> **Note:** The MOD HTTP snapshot endpoint (`/snapshot/load?name=<name>`) was confirmed as the best-known path for this firmware, but may differ across firmware versions. The tool notes this in its output if the call fails.

---

## Board Management

### `save_loaded_pedalboard_as_new`

**Type:** Write-gated (HTTP)

Save the currently loaded live graph as a new user pedalboard. Calls `POST /pedalboard/save` with `asNew=1`. Optionally validates that the expected plugins are present before saving.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes | Title for the saved board. |
| `confirm` | `boolean` | yes | `true` to execute. |
| `expectedPluginUris` | `string[]` | no | URIs to verify are loaded before saving (fidelity check). |
| `loadedBundlePath` | `string` | no | Bundle path hint for the fidelity check. |

#### Output → `SaveLoadedPedalboardResult`

```jsonc
{
  "writeToolsEnabled": true,
  "confirmed": true,
  "title": "My Board",
  "targetExistsBefore": false,
  "loadedGraphValidation": {
    "attempted": true, "success": true,
    "pluginCount": 3, "expectedPluginUris": ["http://..."], "missingPluginUris": []
  },
  "saved": { "attempted": true, "success": true, "endpoint": "/pedalboard/save", "httpStatus": 200, "body": "true" },
  "appearsAfterSave": true,
  "matchingPedalboards": [ { "title": "My Board", "bundlePath": "...", "source": "user" } ],
  "savedBundleInspection": { /* PedalboardInspection */ },
  "apiCalls": [ /* call log */ ],
  "banksSaveCalled": false,
  "directFileWrites": false,
  "notes": []
}
```

---

### `load_existing_pedalboard`

**Type:** Write-gated (HTTP)

Load a saved pedalboard bundle into the live graph. Calls `POST /pedalboard/load_bundle/` with the bundle path. Does not save or call `/banks/save`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlePath` | `string` | yes | Bundle path from `list_pedalboards`. |
| `confirm` | `boolean` | yes | `true` to execute. |

#### Output → `LoadExistingPedalboardResult`

```jsonc
{
  "writeToolsEnabled": true,
  "confirmed": true,
  "bundlePath": "/root/.pedalboards/My Board.pedalboard",
  "targetExistsBefore": true,
  "matchedPedalboard": { "title": "My Board", "bundlePath": "...", "source": "user" },
  "load": { "attempted": true, "success": true, "endpoint": "/pedalboard/load_bundle/" },
  "apiCalls": [ /* call log */ ],
  "banksSaveCalled": false,
  "pedalboardSaveCalled": false,
  "directFileWrites": false,
  "notes": []
}
```

---

### `clear_current_pedalboard`

**Type:** Write-gated (HTTP)

Remove every plugin currently loaded in the live graph using `GET /effect/remove` calls. Does not call disconnect, save, or load endpoints. Leaves the graph empty.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `confirm` | `true` (literal) | yes | Must be the literal value `true`. |

#### Output → `ClearCurrentPedalboardResult`

```jsonc
{
  "writeToolsEnabled": true,
  "confirmed": true,
  "before": {
    "attempted": true, "ok": true, "status": 200,
    "pluginCount": 3, "plugins": [{ "instance": "DS1", "uri": "http://..." }], "text": "..."
  },
  "after": {
    "attempted": true, "ok": true, "status": 200,
    "pluginCount": 0, "plugins": [], "text": "..."
  },
  "removedInstances": ["DS1", "Reverb", "Gain"],
  "removeCalls": [ /* ApiCallRecord[] */ ],
  "success": true,
  "notes": ["Removed 3 plugins"]
}
```

---

## Experimental / Low-Level

These tools are for development, debugging, and pipeline introspection. They are not part of normal AI agent workflows.

### `create_live_graph_authoring_plan`

**Type:** Dry-run (read-only)

Validate a `PedalboardPlan` against real installed plugin metadata and return the exact MOD HTTP calls that would be made — without executing them. Useful for inspecting what `execute_pedalboard_plan` would do.

#### Input

| Field | Type | Description |
|---|---|---|
| `plan` | `PedalboardPlan` | A plan from `plan_pedalboard_from_prompt`. |

#### Output → `LiveGraphAuthoringPlan`

```jsonc
{
  "dryRun": true,
  "sourcePlan": { /* input plan */ },
  "title": "My Board",
  "validation": {
    "valid": true, "errors": [],
    "pluginUris": { "valid": true, "checked": ["http://..."], "missing": [] },
    "ports": { "valid": true, "errors": [] },
    "connections": { "valid": true, "errors": [], "callCount": 4 },
    "parameters": { "valid": true, "errors": [], "callCount": 3 },
    "snapshotSave": { "included": false, "valid": true, "note": "..." },
    "pedalboardSave": { "valid": true, "title": "My Board" }
  },
  "plugins": [
    {
      "role": "overdrive", "name": "Calf Vintage Delay",
      "uri": "http://...", "instance": "Overdrive", "x": 100, "y": 100,
      "addCall": { "method": "GET", "path": "/effect/add//graph/Overdrive?...", "purpose": "Add plugin" },
      "parameterPlans": [ { "symbol": "drive", "value": 0.8, "minimum": 0, "maximum": 1 } ],
      "connectCalls": [ { "method": "GET", "path": "/effect/connect/...", "purpose": "Wire" } ]
    }
  ],
  "apiCalls": [ /* all calls in order */ ],
  "postSaveApiCalls": [],
  "notes": [],
  "unsupportedIdeas": []
}
```

---

### `run_live_graph_builder_dry_run_or_apply`

**Type:** Write-gated (HTTP + WebSocket)

Dry-run or temporarily apply a `LiveGraphAuthoringPlan` using WebSocket validation. If `mode="apply_temporary"`, the chain is applied and then automatically rolled back after `restoreAfterSeconds`. Never saves or calls `/banks/save`.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | `"dry_run"` \| `"apply_temporary"` | yes | Whether to simulate or apply. |
| `confirm` | `boolean` | yes | `true` to execute (`apply_temporary` requires this). |
| `plan` | `LiveGraphAuthoringPlan` | yes | Output of `create_live_graph_authoring_plan`. |
| `restoreAfterSeconds` | `integer` | no | Auto-rollback delay (default: tool decides). |

#### Output → `LiveGraphBuilderResult`

```jsonc
{
  "dryRun": false, "mode": "apply_temporary", "confirmed": true,
  "restoreAfterSeconds": 30,
  "supportedTopology": "linear_chain_v1",
  "plan": { /* LiveGraphBuilderPlan */ },
  "websocket": {
    "url": "ws://192.168.51.1/websocket",
    "rawMessages": ["..."],
    "addObserved": true, "connectObserved": true,
    "disconnectObserved": true, "removeObserved": true,
    "baseline": { /* graph state */ }, "final": { /* graph state */ },
    "finalMatchesBaseline": true
  },
  "apiCalls": [ /* ApiCallRecord[] */ ],
  "success": true, "unexpectedBehavior": [], "notes": []
}
```

---

### `run_live_graph_builder_from_prompt`

**Type:** Write-gated (HTTP + WebSocket)

Build a plan from a `PedalboardPlan` using real plugin metadata, then apply it as a temporary live chain with WebSocket validation and automatic rollback. Combines `create_live_graph_authoring_plan` + `run_live_graph_builder_dry_run_or_apply` in one call.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | `"dry_run"` \| `"apply_temporary"` | yes | |
| `confirm` | `boolean` | yes | |
| `plan` | `PedalboardPlan` | yes | |
| `restoreAfterSeconds` | `integer` | no | |

#### Output

Same as `run_live_graph_builder_dry_run_or_apply` → `LiveGraphBuilderResult`.

---

### `run_live_graph_experiment`

**Type:** Write-gated (HTTP + WebSocket) — experimental

Add TinyGain Mono via `/effect/add`, verify the graph state via WebSocket, then remove it via `/effect/remove`. Does not save or import anything. Used to confirm that the add/remove cycle works on this firmware.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `confirm` | `true` (literal) | yes | Must be the literal value `true`. |

#### Output → `LiveGraphExperimentResult`

```jsonc
{
  "dryRun": false, "confirm": true,
  "plugin": { "name": "TinyGain Mono", "uri": "http://...", "instance": "TinyGainMono", "x": 150, "y": 150 },
  "websocket": {
    "url": "ws://192.168.51.1/websocket", "rawMessages": ["..."],
    "addObserved": true, "removeObserved": true,
    "baselineInstances": [],
    "afterAddInstances": [{ "instance": "TinyGainMono", "uri": "http://..." }],
    "afterRemoveInstances": []
  },
  "activeGraphInspection": {
    "before":       { "attempted": true, "ok": true, "pluginUris": [] },
    "afterAdd":     { "attempted": true, "ok": true, "pluginUris": ["http://..."] },
    "afterRemove":  { "attempted": true, "ok": true, "pluginUris": [] }
  },
  "apiCalls": [ /* ApiCallRecord[] */ ],
  "success": true, "unexpectedBehavior": [], "notes": []
}
```

---

### `run_live_graph_connection_experiment`

**Type:** Write-gated (HTTP + WebSocket) — experimental

Add TinyGain Mono and Bollie Delay, connect them, verify via WebSocket, disconnect, and remove both. Does not save. Used to confirm that `connect`/`disconnect` calls behave correctly on this firmware.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `confirm` | `true` (literal) | yes | Must be the literal value `true`. |

#### Output

Same shape as `run_live_graph_experiment` → `LiveGraphExperimentResult` (extended with connection phase states in the `websocket` field).

---

## Audio Path Validation

### `validate_current_board_audio_path`

**Type:** Read-only (SSH)

BFS scan of the audio connection graph starting from hardware capture ports. Identifies plugins in the active audio chain (`chainPlugins`) versus plugins present in the graph but not connected to the signal path (`orphanPlugins`).

Call after `replace_effect` returns `success=false`, or any time you suspect the signal chain is broken.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path from `list_pedalboards`. |

#### Output → `AudioPathValidationResult`

```jsonc
{
  "broken": false,
  "path": ["capture_1", "DS1", "Reverb", "playback_1"],
  "chainPlugins": [
    { "instance": "DS1", "uri": "http://..." },
    { "instance": "Reverb", "uri": "http://..." }
  ],
  "orphanPlugins": [],
  "notes": ["Audio path is intact. 2 plugins in chain, 0 orphans."]
}
```

**Broken chain example:**
```jsonc
{
  "broken": true,
  "path": ["capture_1", "DS1"],
  "chainPlugins": [{ "instance": "DS1", "uri": "http://..." }],
  "orphanPlugins": [{ "instance": "BigMuff", "uri": "http://..." }],
  "notes": ["AUDIO PATH BROKEN: BigMuff is present in the graph but not connected to capture_1 or playback_1."]
}
```

---

### `remove_orphan_effects`

**Type:** Write-gated (HTTP + SSH)

Remove all plugins identified as orphans by `validate_current_board_audio_path` from the live graph and save in-place. Use with `confirm: false` for a dry run that reports what would be removed without touching the board.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path. |
| `confirm` | `boolean` | yes | `true` to remove. `false` for dry run (list orphans only). |

#### Output → `GraphEditResult`

```jsonc
{
  "success": true,
  "notes": ["Removed orphan: BigMuff", "Saved board in-place."],
  "apiCalls": [
    { "path": "/effect/remove//graph/BigMuff", "status": "success", "httpStatus": 200 }
  ],
  "afterState": { /* PedalboardInspection */ }
}
```

---

### `check_bypass_support`

**Type:** Guard-only (no live probe)

Check whether the HTTP bypass endpoint (`/effect/bypass`) is available on this firmware. Returns `supported=false` without making a live request (the firmware hangs on unknown instance names for this endpoint). Use the `notes` field for guidance on alternatives.

> **Note:** The only reliable way to confirm bypass works is to call `toggle_effect_bypass` on a known valid instance. `check_bypass_support` is a static firmware guard — if `writeApi` is unavailable or the endpoint is known-unsupported, it returns `supported=false`.

#### Input

None.

#### Output → `BypassSupportResult`

```jsonc
{
  "supported": false,
  "notes": [
    "Cannot probe bypass endpoint: writeApi not available.",
    "Alternative: call toggle_effect_bypass on a real instance — check unsupported field in the result.",
    "If unsupported=true: use activate_snapshot to switch between snapshots with/without the effect."
  ],
  "probeResult": null
}
```

---

### `cleanup_snapshot_references`

**Type:** Write-gated (SSH)

After removing a plugin with `remove_effect` or `replace_effect`, this tool reads `snapshots.json` via SSH, removes all entries that reference the removed instance, and writes the file back. Prevents stale snapshot data from causing issues when the board is reloaded.

Requires an active SSH connection to the device.

#### Input

| Field | Type | Required | Description |
|---|---|---|---|
| `bundlepath` | `string` | yes | Bundle path of the affected board. |
| `removedInstance` | `string` | yes | Instance name that was removed (e.g. `"TAP_ChorFlng"`). |
| `confirm` | `boolean` | yes | `true` to write. `false` for dry run (shows what would be removed). |

#### Output

```jsonc
{
  "success": true,
  "removedInstance": "TAP_ChorFlng",
  "snapshotsModified": 2,
  "notes": ["Removed 'TAP_ChorFlng' from 2 snapshot entries in snapshots.json."]
}
```

---

## Common Types

### `ApiCallRecord`

Appears in `apiCalls` arrays across many tools.

```jsonc
{
  "method": "GET",
  "path": "/effect/add//graph/DS1?x=100&y=100&uri=http%3A%2F%2F...",
  "purpose": "Add plugin DS1",
  "status": "success",       // "success" | "failed" | "skipped"
  "httpStatus": 200,         // present when a call was made
  "error": null              // present when status="failed"
}
```

### `GraphEditApiCall`

Lighter version used in surgical edit results.

```jsonc
{
  "path": "/effect/add//graph/Reverb?...",
  "status": "success",
  "httpStatus": 200
}
```

### `PedalboardInspection`

Returned as `afterState` in all surgical edit tools and as the full inspection in `inspect_pedalboard`. See [inspect_pedalboard output](#output-4) for the full shape.
