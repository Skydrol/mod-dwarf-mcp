# MOD Dwarf MCP Manual

This manual is for any AI agent using the MOD Dwarf MCP server.

---

## Responsibility Split

### User-Facing AI

The user-facing AI is the **primary musical decision maker**.

Before requesting pedalboard execution, it must:

1. Call `list_plugins` and read the device inventory.
2. Read the Plugin Knowledge Database if available.
3. Understand the user's musical intent.
4. Research songs, artists, genres, or production styles if needed.
5. Select concrete plugins from the installed plugin list.
6. Build a structured pedalboard recipe.

The recipe must contain:

- selected plugins (by name, not by generic category)
- plugin roles
- intended usage
- routing intent
- snapshot intent
- safety constraints

**Prefer explicit plugin names over generic categories.**

Instead of:

```
modulation, delay, reverb
```

Prefer:

```
TAP Chorus/Flanger, Bollie Delay, Dragonfly Hall Reverb
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
  ↓  (reads)
Device Inventory + Plugin Knowledge Database
  ↓  (produces)
Plugin Selection + Pedalboard Recipe
  ↓
MCP: Validation
  ↓
MCP: Execution
  ↓
MOD Dwarf
```

---

## Preferred Entry Point

| Tool | When to use |
|------|-------------|
| `create_pedalboard_from_recipe` | **Preferred.** Caller has a structured recipe with explicit plugin names, roles, and snapshots. |
| `modify_current_board` | **Preferred for modifications.** Caller wants to change effects or parameters on an existing board. Requires the board's bundlepath and a recipe describing the complete desired final state. |
| `create_pedalboard_from_prompt` | Fallback. Use when a full recipe is not available and the MCP must assist with planning. |
| `execute_pedalboard_plan` | Lower-level. Use when the plan has already been fully built outside the MCP. |
| `plan_pedalboard_from_prompt` | Dry-run inspection only. Use to preview the plan before execution. |
| `create_new_pedalboard` | Empty board only. No plugins. |

The recipe-based flow is the primary architecture because it separates musical intelligence from device execution and keeps the MCP deterministic and testable.

---

## Required Workflow

### First Use

When connecting to a MOD Dwarf for the first time in a session:

1. Call `get_device_info`.
2. Call `list_plugins`.
3. Treat the plugin list as the source of truth for what is physically installed.
4. If available, call `refresh_device_inventory` to generate the local inventory files.
5. Keep the discovered plugin list and inventory as your working reference for the rest of the session.

### Recipe-Driven Use (Preferred)

1. Build an `EffectRecipe` with:
   - song or artist when known
   - instrument
   - operation mode
   - effects with explicit plugin names, roles, and character
   - snapshots
   - sections that reuse snapshots
2. Call `create_pedalboard_from_recipe`.
3. The MCP converts the recipe into a plan and delegates to the execution flow.

### Modify an Existing Board

When the user wants to change the current board (different effects, different parameters, swap a plugin), use the modify flow instead of creating a new board.

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

### Prompt-Driven Use (Fallback)

When a structured recipe is not available:

1. Translate the user request to English before interpreting it or calling the MCP.
2. Decide the effect list yourself. Do not ask the MCP to invent the musical plan.
3. Research external references before calling the MCP if the request depends on song-specific or artist-specific knowledge.
4. Call `list_plugins` if you have not already done so in this session.
5. Cross your own effect list against the installed plugins and adapt it to what the device has.
6. Only after you have an adapted list of effects and snapshots should you call `create_pedalboard_from_prompt`.

---

## Rules for Modifications

- When the user asks to "change", "add", "remove", or "swap" an effect on an existing board, use `modify_current_board`, not `create_pedalboard_from_recipe`.
- Always call `inspect_pedalboard` before modifying. Do not guess what is currently on the board.
- Build the recipe with the **complete desired final state** — include every plugin that should be on the board after modification, not just the ones changing.
- If the user asks to change only parameters (e.g., "make the reverb less wet"), still send the full plugin list. Sending only the changed plugin will remove everything else.

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
2. Research the reference tone: Electro-Harmonix Small Clone chorus into a heavily distorted amp, clean verse / distorted chorus structure.
3. Decide the target chain:
   - fuzz or distortion stage
   - chorus stage
   - output trim if needed
4. Call `list_plugins`. Cross the chain against installed plugins:
   - DS1 or Open Big Muff → distortion
   - TAP Chorus/Flanger → modulation
5. Decide snapshots: Verse (clean, chorus on), Chorus (distorted, chorus on), Lead.
6. Build a recipe with explicit plugin names and snapshot intent.
7. Call `create_pedalboard_from_recipe`.
8. Let the MCP validate, build, and save the board.
