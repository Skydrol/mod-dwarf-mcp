# MOD Dwarf MCP Manual

This manual is for any AI agent using the MOD Dwarf MCP server.

## Required Workflow

### First Use

When you connect to a MOD Dwarf for the first time in a session:

1. Call `get_device_info`.
2. Call `list_plugins`.
3. Treat the plugin list as the source of truth for what is physically installed.
4. If available, call `refresh_device_inventory` to generate the local inventory files.
5. Keep the discovered plugin list and inventory as your working reference for the rest of the session.

### Prompt-Driven Use

When a user asks for a pedalboard or tone:

1. Translate the user request to English before you interpret it or call the MCP.
2. Decide the effect list and change list yourself. The MCP should not invent the musical plan for you.
3. If you need outside musical knowledge, research it before calling the MCP.
4. Call `list_plugins` if you have not already done so in this session.
5. Cross your own effect list against the installed plugins and adapt it to what the device actually has.
6. Only after you have an adapted list of effects and snapshots should you call `create_pedalboard_from_prompt` or `execute_pedalboard_plan`.

### Recipe-Driven Use

If the caller already has a structured recipe:

1. Build an `EffectRecipe` with:
   - song or artist when known
   - instrument
   - operation mode
   - effects with roles and character
   - snapshots
   - sections that reuse snapshots
2. Use `create_pedalboard_from_recipe`.
3. Let the recipe layer convert into a plan and delegate to the existing execution flow.

## Rules

- Never assume a pedal exists unless `list_plugins` confirms it.
- Prefer installed plugins over theoretical or unavailable ones.
- If the exact reference pedal is missing, choose the closest installed substitute and say so.
- Do not ask the MCP to guess the musical intent for you. Provide the target effects and snapshots explicitly.
- Translate the user request to English before using the MCP if the original prompt is in another language.
- Research external musical references before calling the MCP when the request depends on song-specific or artist-specific knowledge that is not already obvious.
- Use `create_new_pedalboard` only for a truly empty board.
- Do not skip the plugin discovery step on the first use of a device.
- Keep a local mental model of the inventory and reuse it instead of rediscovering everything every time.

## Suggested Pattern

For a request like "Smells Like Teen Spirit":

1. Translate the request to English if needed.
2. Research the reference tone if needed.
3. Decide the likely target chain, for example:
   - distortion or fuzz stage
   - chorus or modulation stage
   - output trim if the chain needs it
4. Call `list_plugins`.
5. Cross the intended chain against the installed plugins and substitute the closest available pedals.
6. Decide the snapshots, for example:
   - Verse
   - Chorus
   - Lead
7. Provide the explicit list of adapted effects and snapshots to the MCP.
8. Let the MCP build and save the board.

## Notes

- `create_pedalboard_from_prompt` is the preferred end-to-end tool.
- `create_pedalboard_from_recipe` is the structured entry point when the caller already has a recipe.
- `execute_pedalboard_plan` is the lower-level variant for already planned builds.
- `plan_pedalboard_from_prompt` remains useful for dry-run inspection.
- `refresh_device_inventory` is the first-connection inventory helper.
