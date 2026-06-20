# MOD Dwarf MCP Manual

This manual is for any AI agent using the MOD Dwarf MCP server.

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

### User-Facing AI

The user-facing AI is the **primary musical decision maker**.

Before requesting pedalboard execution, it must:

1. Call `check_inventory_status` to verify the plugin database exists and is not stale.
2. If `exists=false` or `isStale=true`, run `refresh_device_inventory` **before anything else**.
3. Call `list_plugins` to get the full inventory (200+ plugins when inventory is current).
4. **Research the tone online.** Search for what effects/pedals the referenced artist or song used. Do this before calling any MCP tool — the device has 200+ plugins and you need to know which ones match the requested style.
5. Understand the user's musical intent.
6. Select concrete plugins from the installed plugin list that best match the researched tone.
7. Build a structured pedalboard recipe with explicit plugin names (not generic categories).

The recipe must contain:

- selected plugins (by name, not by generic category)
- plugin roles
- intended usage
- routing intent
- snapshot intent
- safety constraints

**Prefer explicit plugin URIs over everything else.**

The most reliable way to pin a plugin is `preferredPluginUri`. The MCP will look up the plugin by exact URI before falling back to name matching or heuristics.

Use `list_plugins` (format: `"both"`) to get URI + name for every installed plugin, then reference the URI directly in the recipe effect:

```json
{
  "role": "delay",
  "character": "rhythmic eighth-note echo",
  "preferredPluginUri": "http://moddevices.com/plugins/mod-devel/BollieDelay",
  "preferredPluginName": "Bollie Delay"
}
```

Priority order the MCP uses for plugin selection:
1. `preferredPluginUri` — exact URI match (most reliable, use this whenever possible)
2. `preferredPluginName` — name hint, prepended to internal heuristic list
3. Heuristic matching by role + character string
4. Scored fallback using the knowledge DB

**Prefer explicit plugin names over generic categories.**

Instead of:

```
modulation, delay, reverb
```

Prefer (with URI):

```json
{ "role": "modulation", "preferredPluginUri": "...", "preferredPluginName": "TAP Chorus/Flanger" }
{ "role": "delay",      "preferredPluginUri": "...", "preferredPluginName": "Bollie Delay" }
{ "role": "reverb",     "preferredPluginUri": "...", "preferredPluginName": "Dragonfly Hall Reverb" }
```

The user-facing AI is responsible for deciding which installed plugins best match the requested tone. Do not delegate musical judgment to the MCP.

---

### MCP

The MCP is the **execution and validation layer**.

The MCP is responsible for:

1. Validating that requested plugins exist on the device.
2. Validating ports and parameter ranges.
3. Validating mono/stereo routing compatibility.
4. Validating safety constraints.
5. Creating or modifying the pedalboard graph.
6. Building connections between plugins and hardware I/O.
7. Applying parameters.
8. Applying layout.
9. Saving the pedalboard.
10. Validating fidelity of the saved result.

The MCP is **not** the primary musical decision maker.

The MCP may provide fallback plugin selection only when:

- no plugin is specified
- a requested plugin does not exist on the device
- a safer alternative is required for technical reasons

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

### Creation Tools

| Tool | When to use |
|------|-------------|
| `create_pedalboard_from_recipe` | **Preferred.** Structured recipe with explicit plugin names, roles, and snapshots. |
| `create_pedalboard_from_prompt` | Fallback. Use when a full recipe is not available and the MCP must assist with planning. |
| `execute_pedalboard_plan` | Lower-level. Use when the plan has already been fully built outside the MCP. |
| `plan_pedalboard_from_prompt` | Dry-run inspection only. Preview the plan before execution. |
| `create_new_pedalboard` | Empty board only. No plugins. |

### Surgical Edit Tools (Incremental Changes)

Use these for targeted single-operation changes. **Do not rebuild the whole board** when one of these suffices.

| Tool | When to use |
|------|-------------|
| `add_effect` | "Add a reverb at the end", "put a boost before the fuzz", "adicionar shimmer". Inserts one plugin and rewires. |
| `remove_effect` | "Remove the chorus", "take out the delay", "tirar o reverb". Disconnects and removes one plugin. |
| `replace_effect` | **"Swap the reverb for X", "replace the chorus with a flanger", "trocar o reverb por outro".** Atomic remove+add+rewire. ⚠️ Do NOT load a different pedalboard when asked to swap one effect — use this. |
| `set_effect_parameter` | "More shimmer", "less delay", "turn up the gain", "mais shimmer", "menos delay". Tweaks knobs in-place. |

All surgical tools:
- Load the board, make the targeted change, save in-place (no new board created)
- Return `afterState`: full board inspection after the change — verify it matches what you intended
- Require `bundlepath` (from `list_pedalboards`) and `confirm: true`
- Require `inspect_pedalboard` first so you know the current state and exact instance names

### Board-Level Modification Tools

| Tool | When to use |
|------|-------------|
| `modify_current_board` | Replace the **entire** signal chain on an existing board. Use when more than one effect changes, or when you want to rebuild the chain. |
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

### "Add reverb to the end of the chain"

Use `add_effect`.

1. Call `list_plugins` to get the plugin URI.
2. Call `list_pedalboards` to get the bundlepath.
3. Call `add_effect` with `position: "last"`.

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "pluginUri": "urn:dragonfly:hall",
  "position": "last",
  "confirm": true
}
```

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

```json
{
  "bundlepath": "/root/.pedalboards/My_Board.pedalboard",
  "instanceToReplace": "TAP_ChorFlng",
  "newPluginUri": "http://moddevices.com/plugins/mod-devel/BigMuff",
  "confirm": true
}
```

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
