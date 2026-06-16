# MOD Dwarf MCP Manual

This manual is for any AI agent using the MOD Dwarf MCP server.

## Required Workflow

1. Call `get_device_info`.
2. Call `list_plugins` and use the installed plugin list as the source of truth for what can actually be built on the connected MOD Dwarf.
3. For the user request, generate your own suggested effect list first.
4. If the request depends on external musical knowledge, you may research it separately before asking MCP to build anything.
5. Only after you have a concrete list of effects and snapshots should you call `create_pedalboard_from_prompt` or `execute_pedalboard_plan`.

## Rules

- Never assume a pedal exists unless `list_plugins` confirms it.
- Prefer installed plugins over theoretical or unavailable ones.
- If the exact reference pedal is missing, choose the closest installed substitute and say so.
- Do not ask the MCP to guess the musical intent for you. Provide the target effects and snapshots explicitly.
- Use `create_new_pedalboard` only for a truly empty board.

## Suggested Pattern

For a request like "Smells Like Teen Spirit":

1. Discover installed plugins.
2. Decide the likely target chain, for example:
   - distortion or fuzz stage
   - chorus or modulation stage
   - output trim
3. Provide the list to the MCP in the prompt.
4. Let the MCP build and save the board.

## Notes

- `create_pedalboard_from_prompt` is the preferred end-to-end tool.
- `execute_pedalboard_plan` is the lower-level variant for already planned builds.
- `plan_pedalboard_from_prompt` remains useful for dry-run inspection.
