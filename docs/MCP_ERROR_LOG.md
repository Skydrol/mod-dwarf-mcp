# MCP Error Log

Purpose: capture the concrete failures observed while exercising the MOD Dwarf MCP so they can be fixed after test runs.

## Current Session

Date: 2026-06-22

### Goal

Create a Hammock-inspired pedalboard for `Tape Recorder` using the MOD Dwarf MCP.

### Successful Preconditions

- `check_inventory_status` returned `exists=true`, `pluginCount=265`, `isStale=false`.
- `get_device_info` confirmed the device was reachable and the inventory was current.
- `list_plugins` returned 265 installed plugins.

### Errors Observed

#### 1. Unsupported recipe field

Tool: `create_pedalboard_from_recipe`

Input issue:
- I included `suggestedInstance` inside each `recipe.effects[]` object.

Error returned:

```text
Invalid arguments for tool create_pedalboard_from_recipe:
unrecognized key(s) in object: 'suggestedInstance'
```

Impact:
- The MCP schema rejects that field even though other tools in the repo use instance naming hints internally.

Likely fix:
- Remove `suggestedInstance` from `create_pedalboard_from_recipe` inputs.
- If instance hints are needed, add them to the planner/planning schema instead of the recipe schema.

#### 2. Parameter range safety failure

Tool: `create_pedalboard_from_recipe`

Input issue:
- I tried to use `http://moddevices.com/plugins/mod-devel/mod-volume-2x2` as an output trim stage.

Error returned:

```text
Safety check failed:
- Parameter 'Mode' on plugin http://moddevices.com/plugins/mod-devel/mod-volume-2x2 has no overlap between requested and device ranges
- Parameter 'Volume' on plugin http://moddevices.com/plugins/mod-devel/mod-volume-2x2 has no overlap between requested and device ranges
- Parameter 'PluginEnabled' on plugin http://moddevices.com/plugins/mod-devel/mod-volume-2x2 has no overlap between requested and device ranges
```

Impact:
- The plugin exists, but the recipe values or the safety model do not match the plugin's actual parameter ranges on this firmware/catalog combination.

Likely fix:
- Re-read the plugin parameters before building the recipe.
- Avoid assuming normalized ranges; derive values from the actual device ranges the MCP reports.
- If the tool is meant to support a generic trim stage, choose a plugin whose numeric ranges overlap the requested defaults.

#### 3. Current board tracking unavailable

Tool: `get_current_board_state`

Error returned:

```text
No current-board tracking file found on the device.
```

Impact:
- The active board cannot be resolved through the tracking file path on this firmware/device state.

Likely fix:
- Fall back to `list_pedalboards` and load/inspect by bundle path when the tracking file is absent.
- If current-board tracking is expected, verify the device-side file that stores the active bundle path.

### Notes

- The board creation itself succeeded after removing the unsupported recipe field and dropping the incompatible trim stage.
- The resulting board was saved as `Tape Recorder - Hammock`.
- This log is meant to capture runtime failures from MCP usage, not general repo lint or unrelated build issues.

