# MCP Tool Discovery Troubleshooting

This note captures the regression we hit where the MCP server exposed 38 tools in code, but Codex discovery only surfaced a smaller subset.

## Symptoms

- `tool_search` only showed a partial `mod_dwarf_mcp` tool list.
- Exact tool names like `cleanup_snapshot_references` could not be discovered even though they existed in `src/server/toolRegistry.ts`.
- The compiled server itself still registered all tools when inspected directly.

## Root Cause

The server code was correct, but the Codex discovery layer had stale metadata cached for the MCP server.

Two details mattered:

1. The tool registry in `src/server/toolRegistry.ts` really did contain 38 registrations.
2. The Codex-facing discovery path was still exposing an older subset, so `tool_search` was not authoritative by itself.

## What Was Changed

- Kept the tool registry explicit in `src/server/toolRegistry.ts`.
- Added a standardized description prefix for each tool so discovery has stable, searchable tool text.
- Bumped the server/package version to force cache invalidation in clients that key off the server signature.
- Updated `docs/TOOL_REFERENCE.md` to match the actual tool count.

## Verification Steps

Run these checks when the issue reappears:

1. Build the project.
2. Inspect the compiled server and confirm `_registeredTools` contains 38 entries.
3. Re-register the MCP in Codex so it points at the rebuilt `dist/index.js`.
4. Query `tool_search` again.

Recommended commands:

```bash
npm run build
codex mcp remove mod_dwarf_mcp
codex mcp add mod_dwarf_mcp --env MOD_DWARF_ENABLE_WRITE_TOOLS=true --env MOD_DWARF_HOST=moddwarf.local --env MOD_DWARF_HTTP_TIMEOUT_MS=10000 --env MOD_DWARF_PORT=80 --env MOD_DWARF_SSH_PASSWORD=mod --env MOD_DWARF_SSH_TIMEOUT_MS=10000 --env MOD_DWARF_SSH_USER=root -- bash -lc 'cd /home/thiago/mod-dwarf-mcp && exec node /home/thiago/mod-dwarf-mcp/dist/index.js'
```

## Recovery Checklist

- Confirm the source tree has 38 `server.registerTool(...)` calls in `src/server/toolRegistry.ts`.
- Confirm the compiled server exposes 38 tools.
- Reinstall the MCP in Codex after a rebuild.
- If discovery still looks truncated, treat `tool_search` as stale and inspect the repo source directly.

## Notes

- The server version was bumped to `0.1.2` during this fix.
- The main workaround was not to trust the discovery cache alone when the runtime server and source tree disagree.
