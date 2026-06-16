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

1. Call `list_plugins` if you have not already done so in this session.
2. Generate your own suggested effect list first.
3. If the request depends on external musical knowledge, you may research it separately before asking MCP to build anything.
4. Decide the snapshots you want before calling the builder.
5. Only after you have a concrete list of effects and snapshots should you call `create_pedalboard_from_prompt` or `execute_pedalboard_plan`.

## Rules

- Never assume a pedal exists unless `list_plugins` confirms it.
- Prefer installed plugins over theoretical or unavailable ones.
- If the exact reference pedal is missing, choose the closest installed substitute and say so.
- Do not ask the MCP to guess the musical intent for you. Provide the target effects and snapshots explicitly.
- Use `create_new_pedalboard` only for a truly empty board.
- Do not skip the plugin discovery step on the first use of a device.
- Keep a local mental model of the inventory and reuse it instead of rediscovering everything every time.

## Suggested Pattern

For a request like "Smells Like Teen Spirit":

1. Discover installed plugins.
2. Research the reference tone if needed.
3. Decide the likely target chain, for example:
   - distortion or fuzz stage
   - chorus or modulation stage
   - output trim if the chain needs it
4. Decide the snapshots, for example:
   - Verse
   - Chorus
   - Lead
5. Provide the explicit list of target effects and snapshots to the MCP.
6. Let the MCP build and save the board.

## Notes

- `create_pedalboard_from_prompt` is the preferred end-to-end tool.
- `execute_pedalboard_plan` is the lower-level variant for already planned builds.
- `plan_pedalboard_from_prompt` remains useful for dry-run inspection.
- `refresh_device_inventory` is the first-connection inventory helper.
