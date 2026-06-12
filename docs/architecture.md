# mod-dwarf-mcp Architecture

`mod-dwarf-mcp` is a read-only MCP server for inspecting MOD Dwarf devices. It exposes tool calls for device metadata, LV2 plugins, pedalboards, banks, and snapshots.

## Layers

- MCP server: registers tools and serializes responses.
- Tools: validate input with Zod and call services.
- Services: implement MOD Dwarf domain operations.
- Clients: provide SSH and HTTP access.
- Parsers: normalize Turtle, JSON, and command output into TypeScript types.

## Read-Only Safety

Phase 1 contains no write tools. The SSH client rejects mutation commands, shell redirection, command chaining, package managers, `modprobe`, and reboot commands. The HTTP client exposes only `GET`.

## Future Write Tools

Write tools should be introduced behind an explicit opt-in environment variable, use MOD's HTTP API when possible, validate generated LV2 bundles offline, and preserve backups before any mutation. Direct file writes should remain a last resort.
