# MOD Dwarf MCP — Developer Guide for Claude

## Entry points

**Creating a pedalboard:** always use `ExecutePedalboardPlanService.execute()`. It handles
`/reset` → live graph build → stray-plugin cleanup → save. Never build the API call sequence
manually — the `normalizeLiveCallPath` logic and connection-pairing edge cases are already
encoded in the service.

**Saving the current board:** `SaveLoadedPedalboardService.saveAsNew()`.

**MCP tools → services map:**
- `create_pedalboard_from_prompt` → `ExecutePedalboardPlanService`
- `execute_pedalboard_plan` → `ExecutePedalboardPlanService`
- `save_loaded_pedalboard` → `SaveLoadedPedalboardService`
- `create_new_pedalboard` → `CreateNewPedalboardService` (empty board only)

## Plugin metadata

`DryBundleService` requires full port metadata (audio port symbols) for every plugin in the
signal chain. `PluginService.getPluginPorts()` resolves metadata in this order:

1. `pluginCatalog` (local, in `src/data/pluginCatalog.ts`) — fastest, no SSH
2. SSH `lv2info <uri>` — requires live device connection

`data/deviceInventory.json` is **not** used for port resolution — it only has port counts,
not the symbols needed to build connections. If a plugin is missing from the catalog and SSH
is unavailable, `DryBundleService` will throw "Metadata missing".

**To add a new plugin to the catalog:** run `lv2info <uri>` on the device (SSH root@moddwarf.local),
parse the port list, and add an entry to `src/data/pluginCatalog.ts`.

## MOD HTTP API — confirmed formats

- Add plugin: `GET /effect/add//graph/<Instance>?x=<x>&y=<y>&uri=<encoded_uri>`
  - Note the double slash: `/effect/add/` + `/graph/<Instance>`
  - Instance name is the slug of `suggestedInstance` (preserves case: `DS1` stays `DS1`)
- Connect ports: `GET /effect/connect//graph/<source>,/graph/<target>`
  - Hardware ports also use the `/graph/` prefix: `/graph/capture_1`, `/graph/playback_1`
  - Plugin ports: `/graph/<Instance>/<portSymbol>` (e.g., `/graph/DS1/In`)
  - `normalizeLiveCallPath()` in `executePedalboardPlanService.ts` applies this transform automatically
- Reset graph: `GET /reset` → returns `true`, clears all plugins
- `/pedalboard/info/` without `?bundlepath=` always returns HTTP 400 on this firmware — never use it

## Common mistakes to avoid

- **Don't call `/pedalboard/info/` without bundlepath** — always returns 400. Use `/reset` to
  guarantee a clean slate, then build the graph from scratch.
- **Don't try `system:capture_1` or bare `capture_1`** for hardware ports in connect calls —
  the correct format is `/graph/capture_1`.
- **Don't skip `ExecutePedalboardPlanService` to call API endpoints directly** — the service
  encodes several non-obvious invariants (double-slash paths, hardware port normalization,
  stray-plugin cleanup, save retry on title collision).
- **Don't rely on `deviceInventory.json` for port symbols** — it only has port counts.

## Device access

- Web UI: `http://moddwarf.local` or `http://192.168.51.1`
- SSH: `ssh root@moddwarf.local` (password: `mod`)
- HTTP API port: 80
