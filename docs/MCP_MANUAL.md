# MOD Dwarf MCP Manual

This manual is for any AI agent using the MOD Dwarf MCP server.

For the complete per-tool input/output reference, see [`TOOL_REFERENCE.md`](TOOL_REFERENCE.md).

---

## ⚠️ BEFORE ANYTHING ELSE — Inventory Required

**The plugin inventory MUST exist and be populated before you use any other tool in this MCP.**

On a fresh install, the inventory does not exist yet. Without it, only 34 hardcoded plugins are accessible — the full 200+ plugin library is invisible. Every pedalboard creation and every surgical edit depends on the inventory.

### First-Use Checklist (run once per device, persists across sessions)

1. **`check_inventory_status`** — Call this first in EVERY session. Check `exists` and `isStale`.
2. **If `exists=false`:** Run `refresh_device_inventory` immediately. Do not call any other tool first.
3. **If `isStale=true`:** Run `refresh_device_inventory` before creating or modifying boards.
4. **`refresh_device_inventory`** takes 2–5 minutes on first run. The result is saved to disk and persists across sessions. You will not need to run it again unless the device firmware changes.
5. After refresh: call **`list_plugins`** to confirm 200+ plugins are now visible.

```
SESSION START
  └─ check_inventory_status
       ├─ exists=false → refresh_device_inventory (REQUIRED, takes 2–5 min)
       ├─ isStale=true → refresh_device_inventory (before creating/modifying boards)
       └─ exists=true, isStale=false → proceed to list_plugins and work
```

**Never skip this check.** An AI that skips `check_inventory_status` will silently operate with an incomplete plugin list and produce wrong results.

---

## After Every Write Operation — Verify the Result

Every surgical edit tool (`add_effect`, `remove_effect`, `replace_effect`, `set_effect_parameter`) returns an `afterState` field in its response. This is a full inspection of the board after the change was saved.

**Always check `afterState` after a write operation** to verify:
- The expected plugins are present (or absent)
- The signal chain looks correct
- Parameters were applied as intended

If `afterState` is null, the save failed — read the `notes` field to understand why.

---

## Responsibility Split

> **The MCP is the hand. The AI agent is the brain.**
>
> The MCP does not know how Nirvana, Tame Impala, or U2 sound. It does not decide which effects a song needs. It executes what the AI agent decides.

### User-Facing AI — Musical Intelligence Layer

The user-facing AI is the **sole musical decision maker**. The MCP does not replace it.

**Before calling any creation tool, the AI agent must:**

1. Call `check_inventory_status` — verify the plugin database exists and is not stale.
2. If `exists=false` or `isStale=true` — run `refresh_device_inventory` before anything else.
3. **Research the target tone.** Search online or use training knowledge: what effects, pedals, and settings does the referenced artist or song use? Do this BEFORE calling the MCP. The device has 200+ plugins; knowing which ones match the style is the AI agent's job, not the MCP's.
4. Call `list_plugins` or `search_plugins` — cross the researched effect list against what is actually installed. Adapt to what the device has.
5. **Decide the signal chain** — specific plugins in order, not generic categories.
6. **Decide snapshots** — name them after song sections (Verse, Chorus, Solo).
7. **Build a structured `EffectRecipe`** — with explicit `preferredPluginUri` for each effect.
8. Call `create_pedalboard_from_recipe`.

**The recipe must contain:**
- selected plugins by URI (`preferredPluginUri`) — not by generic category
- plugin roles and character descriptions
- parameter values when specific settings matter
- snapshots with per-snapshot parameter overrides when needed

**Plugin selection priority (inside the MCP):**
1. `preferredPluginUri` — exact URI match, always wins (use this)
2. `preferredPluginName` — name hint, matched before heuristics
3. Role + character heuristic
4. Scored fallback using the knowledge DB

Prefer URIs. The MCP resolves by URI first. Name hints are a fallback, not the primary method.

```json
{
  "role": "delay",
  "character": "rhythmic eighth-note echo",
  "preferredPluginUri": "http://moddevices.com/plugins/mod-devel/BollieDelay",
  "preferredPluginName": "Bollie Delay"
}
```

**The AI agent is responsible for all musical judgment. Do not delegate that to the MCP.**

---

### MCP — Execution and Translation Layer

The MCP is responsible for:

1. Exposing the connected MOD Dwarf's capabilities (plugins, boards, banks, snapshots).
2. Validating that requested plugins exist on the device.
3. Validating ports, parameter ranges, and routing compatibility.
4. Mapping `EffectRecipe` roles to installed plugins.
5. Generating a `PedalboardPlan` from the recipe.
6. Building connections between plugins and hardware I/O.
7. Applying parameters and layout.
8. Saving the pedalboard via the MOD HTTP API.
9. Returning `afterState` so the AI agent can verify the result.
10. Enforcing write gating (`confirm: true`, `MOD_DWARF_ENABLE_WRITE_TOOLS=true`).

**The MCP is not the musical decision maker.** It may provide fallback plugin selection only when no plugin is specified or the requested one is not installed. In all other cases, the AI agent decides — the MCP executes.

---

## Preferred Production Flow

```
User
  ↓
User-Facing AI
  ↓  (check_inventory_status → refresh if needed)
  ↓  (researches online: song, artist, genre, tone)
  ↓  (reads device inventory via list_plugins)
  ↓  (crosses online findings against installed plugins)
Plugin Selection + Pedalboard Recipe
  ↓
MCP: Validation
  ↓
MCP: Execution
  ↓
MOD Dwarf
```

---

## Tool Reference

### Inventory Tools

| Tool | When to use |
|------|-------------|
| `check_inventory_status` | **⚠️ MANDATORY FIRST CALL in every session.** Returns exists, pluginCount, ageHours, isStale. |
| `refresh_device_inventory` | Run when inventory is missing or stale. Takes 2–5 minutes. Persists across sessions. |
| `list_plugins` | List all installed plugins (URI + name). Use for full inventory dump. |
| `search_plugins` | **Find plugins by keyword** (e.g. 'shimmer', 'dragonfly', 'chorus'). Preferred over list_plugins when looking for a specific type. |
| `get_plugin_parameters` | **Get all control parameters for a plugin URI** — symbol, label, range, default. Call this before set_effect_parameter to avoid guessing symbols. |

### Board Discovery Tools

| Tool | When to use |
|------|-------------|
| `get_current_board_state` | **"What's loaded right now?"** Returns the currently active board (plugins, connections, snapshots) without knowing the bundlepath. Call at the start of any modification session. May return `found=false` on some firmware — in that case use list_pedalboards. |
| `list_pedalboards` | List all user and factory boards with bundlepaths. Required input for most tools. |
| `inspect_pedalboard` | Full inspection of a specific board by bundlepath — plugins, connections, snapshots, mappings. Always call before modifying. |
| `list_snapshots` | List named snapshots for a board. |
| `list_banks` | List bank assignments. |

### Creation Tools

| Tool | When to use |
|------|-------------|
| `create_pedalboard_from_recipe` | **Preferred.** Structured recipe with explicit plugin names, roles, and snapshots. |
| `create_pedalboard_from_prompt` | Fallback. Use when a full recipe is not available and the MCP must assist with planning. |
| `execute_pedalboard_plan` | Lower-level. Use when the plan has already been fully built outside the MCP. |
| `plan_pedalboard_from_prompt` | Dry-run inspection only. Preview the plan before execution. |
| `create_new_pedalboard` | Empty board only. No plugins. |
| `duplicate_pedalboard` | **Copy an existing board to a new title.** Use before any significant modification to preserve the original. |

### Surgical Edit Tools (Incremental Changes)

Use these for targeted single-operation changes. **Do not rebuild the whole board** when one of these suffices.

| Tool | When to use |
|------|-------------|
| `add_effect` | "Add a reverb at the end", "put a boost before the fuzz", "adicionar shimmer", "adicione um fuzz depois desse reverb". Supports `position: "after:<instance>"` and `"before:<instance>"`. |
| `remove_effect` | "Remove the chorus", "take out the delay", "tirar o reverb". Disconnects and removes one plugin. After removal, call `cleanup_snapshot_references` to remove stale snapshot entries. |
| `replace_effect` | **"Swap the reverb for X", "replace the chorus with a flanger", "trocar o reverb por outro".** Atomic remove+add+rewire. ⚠️ Check `success` — returns `false` if 0 connections were rewired. |
| `set_effect_parameter` | "More shimmer", "less delay", "turn up the gain", "mais shimmer", "menos delay". Tweaks knobs in-place. |
| `toggle_effect_bypass` | **"Bypass the reverb", "disable the fuzz"**. ⚠️ Returns `unsupported=true` on some firmware — call `check_bypass_support` first. |
| `activate_snapshot` | **"Switch to Solo", "go to the Clean preset", "ir para o snapshot Solo"**. Loads a named snapshot on the current board. |
| `validate_current_board_audio_path` | **Always call after `replace_effect` returns `success=false`.** Detects broken chains and orphan plugins. |
| `remove_orphan_effects` | Remove disconnected plugins from the audio path. Call when `validate_current_board_audio_path` reports `orphanPlugins.length > 0`. |
| `cleanup_snapshot_references` | Remove stale entries in `snapshots.json` after `remove_effect` or `replace_effect`. |
| `check_bypass_support` | Probe whether the HTTP bypass endpoint works on this firmware before calling `toggle_effect_bypass`. |

All surgical tools:
- Load the board, make the targeted change, save in-place (no new board created)
- Return `afterState`: full board inspection after the change — verify it matches what you intended
- Require `bundlepath` (from `list_pedalboards`) and `confirm: true`
- Require `inspect_pedalboard` first so you know the current state and exact instance names

### Board-Level Modification Tools

| Tool | When to use |
|------|-------------|
| `modify_current_board` | Replace the **entire** signal chain on an existing board. Use when more than one effect changes, or when you want to rebuild the chain. |
| `duplicate_pedalboard` | Copy a board before modifying. Preserves plugins, connections, snapshots, and addressings. |
| `inspect_pedalboard` | Read current plugins, connections, and snapshots from a board. Always call this before modifying. |
| `list_pedalboards` | Find board bundlepaths. Required input for all modification tools. |

---

## Required Workflow

### Step 1 — Check Inventory (Every Session)

**Always call `check_inventory_status` before creating pedalboards.**

```json
{ "exists": false, "pluginCount": 0, "isStale": true, "message": "Inventory not found..." }
```

If `exists=false` or `isStale=true`, run `refresh_device_inventory` before proceeding. Without inventory, only 34 hardcoded plugins are visible — the full 200+ device library is inaccessible.

### Step 2 — Initialize Inventory (First Use Only)

1. Call `get_device_info` to confirm the device is reachable.
2. Call `refresh_device_inventory`. **This step is mandatory before any pedalboard creation on a fresh install.** It scans all 200+ LV2 plugins on the device and writes `data/pluginKnowledgeDb.json`.
3. Call `list_plugins` to confirm the full inventory is now accessible.
4. Keep the discovered plugin list as your working reference for the rest of the session.

Note: `refresh_device_inventory` takes 2–5 minutes on first run. The result persists across sessions until a device firmware update changes the installed plugin set.

### Step 3 — Research + Select Plugins

1. **Research the reference tone.** Before building the recipe, search online for what effects/pedals/settings the artist or song actually used. Examples: "what gear did Slash use on November Rain?", "guitar tone for Smells Like Teen Spirit". If the user does not name a specific song, use your musical knowledge to suggest a plausible rig.
2. **Read the device inventory.** Call `list_plugins` and cross your researched effect list against what is installed. Pick the closest available plugin for each role.
3. **Never invent plugin URIs.** All URIs must come from `list_plugins` output. Invented URIs will fail.
4. **Never invent parameter symbols.** All parameter symbols must come from `inspect_pedalboard` output. Invented symbols will be silently ignored or cause errors.

### Step 4 — Execute

Choose the right tool for the operation:

**Creating a new board:**
- Build an `EffectRecipe` with effects, explicit URIs, snapshots.
- Call `create_pedalboard_from_recipe`.

**Incremental change to existing board:**
- Call `inspect_pedalboard` to get current state and instance names.
- Use the appropriate surgical tool: `add_effect`, `remove_effect`, `replace_effect`, or `set_effect_parameter`.
- These tools do NOT rebuild the whole board — they make the targeted change only.

**Rebuilding the whole chain on an existing board:**
- Build an `EffectRecipe` describing the **complete desired final state**.
- Call `modify_current_board` with the board's `bundlepath`.

---

## Recipe-Driven Use (Preferred)

1. **Research the reference tone.** Before building the recipe, search online for what effects/pedals/settings the artist or song actually used. Examples: "what gear did Slash use on November Rain?", "guitar tone for Smells Like Teen Spirit". If the user does not name a specific song, use your musical knowledge to suggest a plausible rig.
2. **Read the device inventory.** Call `list_plugins` and cross your researched effect list against what is installed. Pick the closest available plugin for each role.
3. **Build an `EffectRecipe`** with:
   - song or artist when known
   - instrument
   - operation mode (`new_board`)
   - effects with explicit plugin URIs (`preferredPluginUri`) and names, roles, and character
   - optional explicit parameter values per effect (`parameters: { "gain": 0.8 }`)
   - snapshots (named after song sections: Verse, Chorus, Solo, etc.)
   - optional explicit snapshot parameter overrides (`parameterValues: { "overdrive_1": { "gain": 0.9 } }`)
   - sections that reuse snapshots
4. Call `create_pedalboard_from_recipe`.
5. The MCP converts the recipe into a plan and delegates to the execution flow.

---

## Surgical Edits — Incremental Changes

When the user asks for a **targeted change** to an existing board, use the surgical edit tools instead of rebuilding the entire board. These tools are faster, safer, and preserve unchanged plugins.

### "More shimmer" / "Less delay" / "Turn up the reverb"

Use `set_effect_parameter`.

1. Call `list_pedalboards` to get the board's `bundlepath`.
2. Call `inspect_pedalboard` to find the instance name and the plugin's URI.
3. Call `get_plugin_parameters` with the plugin URI to get every control symbol with ranges and defaults.
4. Call `set_effect_parameter` with the bundlepath, instance name, and `parameters: { symbol: value }`.
5. Check `afterState` in the response to confirm the change was applied correctly.

```json
// Step 3 — get_plugin_parameters
{ "uri": "http://moddevices.com/plugins/fomp/DragonflyHallReverb" }
// → returns: { "symbol": "dry_level", "minimum": 0, "maximum": 100, "default": 80 }, ...

// Step 4 — set_effect_parameter
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "instance": "reverb_3",
  "parameters": { "dry_level": 60, "wet_level": 40 },
  "confirm": true
}
```

**Never guess parameter symbols.** If you pass a wrong symbol, the tool returns the full list of valid symbols — use that to retry. Always call `get_plugin_parameters` first when unsure.

### "Add reverb to the end of the chain" / "Add a fuzz after the DS1"

Use `add_effect`. The `position` field supports:
- `"last"` — after the last plugin (before hardware output)
- `"first"` — before the first plugin (after hardware input)
- `"after:<instance>"` — immediately after a named plugin (e.g. `"after:DS1"`)
- `"before:<instance>"` — immediately before a named plugin (e.g. `"before:Reverb"`)

Instance names come from `inspect_pedalboard`.

```json
{ "bundlepath": "...", "pluginUri": "urn:dragonfly:hall", "position": "last", "confirm": true }
{ "bundlepath": "...", "pluginUri": "http://...", "position": "after:DS1", "confirm": true }
{ "bundlepath": "...", "pluginUri": "http://...", "position": "before:Reverb", "confirm": true }
```

After every `add_effect`, check `afterState.connections` to confirm the new plugin appears in the chain.

### "Remove the chorus"

Use `remove_effect`. Set `reconnect: true` (default) to preserve signal flow.

1. Call `inspect_pedalboard` to find the instance name.
2. Call `remove_effect`.

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "instance": "TAP_ChorFlng",
  "reconnect": true,
  "confirm": true
}
```

### "Swap the flanger for a chorus" / "Replace the DS1 with a Big Muff"

Use `replace_effect`. Atomic remove + add + rewire.

1. Call `inspect_pedalboard` to find the instance to replace.
2. Call `list_plugins` to get the new plugin's URI.
3. Call `replace_effect`.
4. **Check `success` and the rewired connection counts in `notes` before reporting success.**

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "instanceToReplace": "TAP_ChorFlng",
  "newPluginUri": "http://moddevices.com/plugins/mod-devel/BigMuff",
  "confirm": true
}
```

**⚠️ Critical: `replace_effect` returns `success=false` if the replaced plugin had connections but 0 were rewired.** This means the audio path is broken — the new plugin is present in the graph but not connected to anything. If this happens:
1. Call `validate_current_board_audio_path` to see the actual state.
2. Call `remove_orphan_effects` to remove the disconnected plugin.
3. Use `add_effect` with `position: "after:<prev>"` or `"before:<next>"` to re-insert at the correct position with explicit connections.

After every successful `replace_effect`, verify `afterState.connections` shows the new instance connected to the expected neighbours.

### "Bypass the reverb" / "Disable the chorus"

> **⚠️ Bypass via HTTP is NOT reliable on this firmware.**
>
> On MOD Dwarf firmware v1.13.5.3315 and similar versions, the `/effect/bypass` HTTP endpoint returns HTTP 404. `toggle_effect_bypass` will return `unsupported=true` on these devices. Real bypass (the LED button on the hardware) is controlled via WebSocket, not HTTP.
>
> Call `check_bypass_support` to probe the endpoint before relying on it.

**If bypass IS supported** (check_bypass_support returns `supported=true`):

Use `toggle_effect_bypass` with `bypassed: true` to disable, `false` to enable.

```json
{ "bundlepath": "...", "instance": "reverb_3", "bypassed": true, "persist": false, "confirm": true }
```

**If bypass is NOT supported** (returns `unsupported=true`):

Do NOT simulate bypass by setting parameters (drive/gain/wet) to zero. That is NOT bypass — it changes the signal path but the plugin's DSP is still running, and the LED state on the hardware does not reflect it.

The correct alternatives:
1. **Snapshot-based switching**: Create two snapshots — one with the effect active and one with it removed from the chain via `modify_current_board`. Switch between them with `activate_snapshot`.
2. **Remove the effect**: If the user wants the effect permanently off, use `remove_effect` instead of faking bypass.
3. **Accept the limitation**: Tell the user that live bypass toggle is not available via MCP on this firmware and must be done from the MOD web UI.

### "Switch to the Solo snapshot" / "Go to the Clean preset"

Use `activate_snapshot`.

1. Call `list_snapshots` or `inspect_pedalboard` to see available snapshot names.
2. Call `activate_snapshot` with the exact snapshot name.

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "snapshotName": "Solo",
  "confirm": true
}
```

Snapshot names are case-insensitive when matching (the tool normalizes both sides). If the name doesn't match, the tool returns all available snapshot names.

### "Duplicate this board before I change it"

Use `duplicate_pedalboard`.

1. Call `list_pedalboards` to get the source bundlepath.
2. Call `duplicate_pedalboard` with a new title.

```json
{
  "sourceBundlePath": "/root/.pedalboards/Pink_Floyd_Shine.pedalboard",
  "newTitle": "Pink Floyd Shine — Copy",
  "confirm": true
}
```

The duplicate is saved as a new user board, preserving all plugins, connections, parameters, snapshots, and addressings. The original is untouched.

**Recommended flow for significant modifications:**
1. `duplicate_pedalboard` → create backup copy
2. Work on the copy (use surgical tools or `modify_current_board`)
3. If satisfied, delete the backup manually via the MOD device UI

---

## Modify an Existing Board (Full Rebuild)

When the user wants to change **several effects or the whole chain** on an existing board (not just one targeted change), use `modify_current_board`.

1. Call `list_pedalboards` to find the board the user is referring to and get its `bundlePath`.
2. Call `inspect_pedalboard` with that `bundlePath` to see which plugins are currently installed, their signal chain, and existing snapshots.
3. Decide the complete desired final state: which plugins to keep, which to remove, which to add, and what the new parameters and snapshots should be.
4. Build an `EffectRecipe` with `operationMode: "modify_current_board"` that describes **the complete desired chain** (not just the delta — include unchanged plugins too).
5. Call `modify_current_board` with the `bundlePath`, the recipe, and `confirm: true`.

The MCP will:
- Load the bundle onto the device (setting it as the active board)
- Remove every existing plugin from the live graph
- Apply the new signal chain from the recipe
- Save the result back to the **same bundlepath** (in-place, no new board created)
- Write named snapshots via SSH

Key constraints:
- Always provide the **complete** desired plugin list in the recipe, not just what changes. The MCP replaces the entire graph.
- Use `inspect_pedalboard` to understand the current state before deciding what to change.
- The board's bundlepath stays the same after modification — no duplicate is created in the library.

> **⚠️ Known firmware behavior:** On some firmware versions, `modify_current_board` may create a NEW board (e.g. "Lithium (2)") instead of overwriting the original. This happens if the firmware loses its "active bundle" designation between the plugin removal step and the save step. If the result notes include "WARNING: modify saved to '...' instead of the target '...'" — the original board was NOT modified. In that case: delete the accidentally created duplicate from the MOD web UI, use `duplicate_pedalboard` to create a safe copy of the original, then apply changes via surgical tools (`add_effect`, `remove_effect`, `replace_effect`).

**For smaller changes, use the surgical tools** (`add_effect`, `remove_effect`, `replace_effect`, `set_effect_parameter`) instead. They are faster and safer.

---

## Parameter-Only Update

When you only want to tweak parameter values on an existing board — without removing or re-adding any plugins — you can either:

1. Use `set_effect_parameter` (surgical, preferred for single-instance tweaks).
2. Or use `modify_current_board` with `operationMode: "parameter_only"`.

### Using `set_effect_parameter` (preferred for small tweaks)

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "instance": "BollieDelay",
  "parameters": { "Time": 0.375, "Feedback": 0.45 },
  "confirm": true
}
```

### Using `modify_current_board` with `parameter_only` mode

The MCP will:
- Load the bundle (sets it as the active board)
- Skip plugin removal and plugin addition entirely
- Apply only `effect/parameter/set` calls for parameters in the recipe
- Write named snapshots via SSH if `parameterValues` are specified in the recipe
- Save the result back to the **same bundlepath** (in-place)

```json
{
  "instrument": "guitar",
  "operationMode": "parameter_only",
  "effects": [
    {
      "role": "reverb",
      "character": "less wet",
      "preferredPluginUri": "http://...",
      "parameters": { "wet_level": 0.3 }
    }
  ],
  "snapshots": [],
  "sections": []
}
```

Use `modify_current_board` with this recipe and the board's `bundlePath`. The plugin graph is untouched; only parameter values change.

#### Example: Add reverb to a board that only has distortion

```json
{
  "song": "My Song",
  "artist": "My Band",
  "instrument": "guitar",
  "operationMode": "modify_current_board",
  "effects": [
    { "role": "distortion", "character": "DS1 for crunch", "intensity": "medium" },
    { "role": "reverb", "character": "Dragonfly Hall Reverb for ambience", "intensity": "subtle" }
  ],
  "snapshots": [
    { "name": "Dry", "description": "Distortion only, no reverb", "effectFocus": { "reverb": "none" } },
    { "name": "Wet", "description": "Distortion with room reverb", "effectFocus": { "reverb": "medium" } }
  ],
  "sections": []
}
```

Call: `modify_current_board({ bundlepath: "/root/.pedalboards/My_Song.pedalboard", recipe: <above>, confirm: true })`

---

## Audio Path Validation

Use the validation tools to detect broken chains and orphan plugins without touching the board.

### After `replace_effect` returns `success=false`

```json
{ "bundlepath": "/root/.pedalboards/My_Board.pedalboard" }
```

Call `validate_current_board_audio_path`. The response shows:
- `chainPlugins`: plugins reachable from `capture_1`/`capture_2` via the connection graph
- `orphanPlugins`: plugins present in the graph but not connected to the audio path
- `broken`: `true` if any chain plugin is a dead end (no outgoing connections toward playback)
- `path`: ordered instance names from input to output

If `orphanPlugins.length > 0`, call `remove_orphan_effects`:

```json
{ "bundlepath": "...", "confirm": true }
```

This removes the disconnected plugin(s) and saves the board in-place.

### After `remove_effect` — clean up stale snapshot references

When a plugin is removed, any snapshot that referenced that instance by name becomes stale. Call `cleanup_snapshot_references`:

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "removedInstance": "TAP_ChorFlng",
  "confirm": true
}
```

This reads `snapshots.json` via SSH, removes the stale entries, and writes it back.

---

## Prompt-Driven Use (Fallback)

When a structured recipe is not available:

1. Translate the user request to English before interpreting it or calling the MCP.
2. Decide the effect list yourself. Do not ask the MCP to invent the musical plan.
3. Research external references before calling the MCP if the request depends on song-specific or artist-specific knowledge.
4. Call `list_plugins` if you have not already done so in this session.
5. Cross your own effect list against the installed plugins and adapt it to what the device has.
6. Only after you have an adapted list of effects and snapshots should you call `create_pedalboard_from_prompt`.

---

## Rules for Modifications

- When the user asks to "change", "add", "remove", or "swap" **one effect**, use the surgical edit tools (`add_effect`, `remove_effect`, `replace_effect`), not `modify_current_board`.
- When the user asks to change **several things at once** or "redo the whole board", use `modify_current_board`.
- When the user says "more X" or "less X" or names a knob, use `set_effect_parameter`.
- When the user says "bypass" or "disable" or "enable" an effect, use `toggle_effect_bypass` — do NOT remove and re-add the plugin.
- When the user says "switch to X snapshot", use `activate_snapshot` — do NOT modify the board or reload it.
- Before significant modifications, offer to `duplicate_pedalboard` as a safety backup.
- Always call `inspect_pedalboard` before modifying. Do not guess what is currently on the board or what the instance names are.
- For `modify_current_board`, build the recipe with the **complete desired final state** — include every plugin that should be on the board after modification, not just the ones changing.
- If the user asks to change only parameters (e.g., "make the reverb less wet"), use `set_effect_parameter` unless you want named snapshots to also update (in which case use `parameter_only` mode with `modify_current_board`).

---

## Anti-Improvisation Rules

These rules exist because AI models have been observed inventing plugin details that don't exist on the device:

1. **Never invent a plugin URI.** All URIs must come from `list_plugins` or `search_plugins` output. Invented URIs cause "plugin not found" failures.
2. **Never invent a parameter symbol.** Call `get_plugin_parameters` first. Invented symbols either fail (with a helpful error listing valid symbols) or are silently ignored.
3. **Never invent an instance name.** Instance names come from `inspect_pedalboard`. Invented instance names cause removal/replace/parameter operations to fail.
4. **Never skip `check_inventory_status` at session start.** A stale or missing inventory means only 34 plugins are visible instead of 200+.
5. **Never use `modify_current_board` when a surgical tool suffices.** Rebuilding the whole board for a one-knob change is slow and risky.
6. **Never call creation tools without knowing what's installed.** `list_plugins` is mandatory before any creation flow.
7. **Never load a different pedalboard when asked to swap one effect.** Use `replace_effect` — it swaps the plugin in-place without changing the board. Loading another board loses the user's current setup.
8. **Always verify `afterState` after every write operation.** Every surgical tool returns `afterState` — check it to confirm the board looks as intended before reporting success to the user.
9. **Never fake bypass by setting gain/wet/drive parameters to zero.** This is NOT bypass. The plugin still processes audio; only the parameter value changes. Real bypass routes signal around the plugin entirely and changes the LED on the hardware. If `toggle_effect_bypass` returns `unsupported=true`, tell the user — do not silently degrade to parameter zeroing.
10. **Never assume `replace_effect` succeeded without checking `success`.** If `success=false`, the audio path is broken. Call `validate_current_board_audio_path` immediately and `remove_orphan_effects` to clean up.
11. **Never add probe plugins to the board to test behavior.** Do not add a temporary "test" plugin and then remove it — this alters the live graph and may accumulate stale connections. Use `validate_current_board_audio_path` and `check_bypass_support` instead.
12. **Duplicate before significant modifications.** Call `duplicate_pedalboard` to create a backup copy before using `modify_current_board` or a sequence of surgical edits. This is the safety net.

---

## Rules

- Never assume a plugin exists unless `list_plugins` confirms it.
- Prefer installed plugins over theoretical or unavailable ones.
- If the exact reference pedal is missing, choose the closest installed substitute and say so.
- Do not ask the MCP to guess the musical intent. Provide target effects and snapshots explicitly.
- Translate the user request to English before using the MCP if the original prompt is in another language.
- Research external musical references before calling the MCP when the request depends on song-specific or artist-specific knowledge.
- Use `create_new_pedalboard` only for a truly empty board with no plugins.
- Do not skip plugin discovery on the first use of a device.
- Keep a mental model of the inventory and reuse it instead of rediscovering it every turn.

---

## Example: Smells Like Teen Spirit

1. Translate the request to English if needed.
2. Call `check_inventory_status`. If stale or missing, run `refresh_device_inventory`.
3. Research the reference tone: Electro-Harmonix Small Clone chorus into a heavily distorted amp, clean verse / distorted chorus structure.
4. Decide the target chain:
   - fuzz or distortion stage
   - chorus stage
   - output trim if needed
5. Call `list_plugins`. Cross the chain against installed plugins:
   - DS1 or Open Big Muff → distortion
   - TAP Chorus/Flanger → modulation
6. Decide snapshots: Verse (clean, chorus on), Chorus (distorted, chorus on), Lead.
7. Build a recipe with explicit plugin names and snapshot intent.
8. Call `create_pedalboard_from_recipe`.
9. Let the MCP validate, build, and save the board.

---

## Example: "More shimmer on the Shine On board"

1. Call `list_pedalboards` → find `/root/.pedalboards/Pink_Floyd_Shine.pedalboard`.
2. Call `inspect_pedalboard` → find instance name (e.g. `DragonFly`) and available parameter symbols (e.g. `Decay`, `Mix`, `Width`).
3. Call `set_effect_parameter`:
   ```json
   {
     "bundlepath": "/root/.pedalboards/Pink_Floyd_Shine.pedalboard",
     "instance": "DragonFly",
     "parameters": { "Decay": 0.9, "Mix": 0.75 },
     "confirm": true
   }
   ```
4. Done. The board is saved in-place.

---

## Example: "Replace the chorus with a flanger"

1. Call `list_pedalboards` → get bundlepath.
2. Call `inspect_pedalboard` → find chorus instance name (e.g. `TAP_ChorFlng`).
3. Call `list_plugins` → find flanger URI.
4. Call `replace_effect`:
   ```json
   {
     "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
     "instanceToReplace": "TAP_ChorFlng",
     "newPluginUri": "http://...",
     "confirm": true
   }
   ```
5. Done. The board is saved in-place with the flanger wired in the same position as the chorus.
