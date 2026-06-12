# mod-dwarf-mcp

Read-only MCP server for the MOD Dwarf pedalboard platform.

The server inspects a MOD Dwarf over SSH and, where useful in future phases, GET-only HTTP. Phase 1 never writes to the device, never installs packages, never reboots, and never modifies pedalboards, banks, snapshots, or plugins.

## Features

- `get_device_info`: firmware, OS, kernel, plugin counts, pedalboard counts
- `list_plugins`: installed LV2 plugins by name, URI, or both
- `list_pedalboards`: user and factory pedalboard bundles
- `inspect_pedalboard`: bundle structure, plugins used, connections, mappings, snapshots, metadata
- `list_banks`: user and factory banks
- `list_snapshots`: snapshots for one pedalboard
- `plan_pedalboard_from_prompt`: dry-run pedalboard plan using installed plugins only
- `create_pedalboard_dry_bundle`: generate a local temporary LV2 pedalboard bundle from a plan; uploads nothing
- `import_pedalboard_dry_bundle`: write-gated MOD UI API import for a generated dry bundle; disabled by default

## Requirements

- Node.js 20.10+
- SSH access to the MOD Dwarf
- MOD Dwarf reachable from the MCP host

## Install

```bash
git clone https://github.com/your-org/mod-dwarf-mcp.git
cd mod-dwarf-mcp
npm install
cp .env.example .env
```

Edit `.env`:

```env
MOD_DWARF_HOST=moddwarf.local
MOD_DWARF_PORT=80
MOD_DWARF_SSH_USER=root
MOD_DWARF_SSH_PASSWORD=from_env
MOD_DWARF_SSH_TIMEOUT_MS=10000
MOD_DWARF_HTTP_TIMEOUT_MS=10000
MOD_DWARF_ENABLE_WRITE_TOOLS=false
```

Build:

```bash
npm run build
```

Run with stdio MCP transport:

```bash
npm start
```

## Safety Model

Phase 1 is read-only by design. Phase 2 adds planning only. Phase 3A can write generated files only to a local temporary directory on the MCP host; it does not upload to the MOD Dwarf, call MOD APIs, or modify device pedalboards. Phase 3B adds a write-gated import tool that is disabled unless `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and the tool input includes `confirm=true`. It uses MOD UI API endpoints only, returns every API call attempted, and never falls back to direct file writes.

The SSH client allows only read-oriented commands such as `cat`, `find`, `ls`, `sed -n`, `uname`, `lv2ls`, `test`, `readlink`, `printf`, `grep`, and `wc`.

It rejects commands containing mutation operations or risky shell syntax, including:

- `rm`, `mv`, `cp`, `touch`, `mkdir`, `chmod`, `chown`, `ln`, `tee`
- `modprobe`, `reboot`, `systemctl`, package managers
- shell redirection and command chaining
- `sed -i`

The read HTTP client implements GET only. Phase 3B uses a separate write HTTP client that is constructed only when write tools are explicitly enabled.

## MCP Tool Examples

### get_device_info

Input:

```json
{}
```

Output includes:

```json
{
  "firmwareVersion": "v1.13.5.3315",
  "kernel": "Linux moddwarf 6.1.15-rt7-moddwarf",
  "counts": {
    "lv2Plugins": 265,
    "userPedalboards": 58,
    "factoryPedalboards": 164
  }
}
```

### list_plugins

```json
{
  "format": "names"
}
```

### list_pedalboards

```json
{
  "source": "all"
}
```

### inspect_pedalboard

```json
{
  "bundlePath": "/root/.pedalboards/Dave.pedalboard"
}
```

### list_banks

```json
{
  "source": "user"
}
```

### list_snapshots

```json
{
  "bundlePath": "/root/.pedalboards/Dave.pedalboard"
}
```

### plan_pedalboard_from_prompt

Dry-run only. This tool inspects installed plugins and existing pedalboards, then proposes a signal chain, snapshots, and parameter ranges. It writes nothing and calls no POST endpoints.

```json
{
  "style": "ambient clean",
  "instrument": "guitar",
  "goals": ["wide stereo reverb", "simple gain staging", "delay for lead lines"],
  "referenceArtists": ["Brian Eno", "The Edge"]
}
```

### create_pedalboard_dry_bundle

Dry-run local generation only. Pass the full `plan_pedalboard_from_prompt` result as `plan`. The tool creates `manifest.ttl`, the main TTL file, `snapshots.json`, and `addressings.json` under a local temp directory, then returns file paths and validation. It does not upload anything or call MOD APIs.

```json
{
  "plan": {
    "dryRun": true,
    "safety": {
      "writesFiles": false,
      "modifiesDevice": false,
      "callsPostEndpoints": false
    },
    "request": {
      "style": "ambient clean",
      "instrument": "guitar",
      "goals": ["wide stereo reverb"]
    },
    "template": null,
    "availablePluginCount": 265,
    "signalChain": [],
    "snapshots": [],
    "notes": [],
    "unsupportedIdeas": []
  }
}
```

### import_pedalboard_dry_bundle

Write-gated import. Requires `MOD_DWARF_ENABLE_WRITE_TOOLS=true` in the server environment and explicit `confirm: true` in the tool input. The input must be the full result from `create_pedalboard_dry_bundle`. The tool uploads through MOD UI API candidates only, exports a backup first when the target name already exists, returns every API call attempted, and does not fall back to direct file writes if API import fails.

```json
{
  "dryBundle": {
    "dryRun": true,
    "sourcePlan": {},
    "directoryPath": "/tmp/mod-dwarf-mcp-example",
    "bundlePath": "/tmp/mod-dwarf-mcp-example/example.pedalboard",
    "generatedFiles": {
      "manifest": "/tmp/mod-dwarf-mcp-example/example.pedalboard/manifest.ttl",
      "mainTtl": "/tmp/mod-dwarf-mcp-example/example.pedalboard/example.ttl",
      "snapshots": "/tmp/mod-dwarf-mcp-example/example.pedalboard/snapshots.json",
      "addressings": "/tmp/mod-dwarf-mcp-example/example.pedalboard/addressings.json"
    },
    "validation": {}
  },
  "confirm": true,
  "targetName": "Example"
}
```

## Claude Desktop Configuration

After building, add a server entry similar to this:

```json
{
  "mcpServers": {
    "mod-dwarf-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mod-dwarf-mcp/dist/index.js"],
      "env": {
        "MOD_DWARF_HOST": "moddwarf.local",
        "MOD_DWARF_PORT": "80",
        "MOD_DWARF_SSH_USER": "root",
        "MOD_DWARF_SSH_PASSWORD": "your-password"
      }
    }
  }
}
```

## Codex Usage

Build the project and register it as a local MCP server in the Codex environment that supports custom MCP servers:

```json
{
  "mcpServers": {
    "mod-dwarf-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mod-dwarf-mcp/dist/index.js"],
      "env": {
        "MOD_DWARF_HOST": "moddwarf.local",
        "MOD_DWARF_PORT": "80",
        "MOD_DWARF_SSH_USER": "root",
        "MOD_DWARF_SSH_PASSWORD": "your-password"
      }
    }
  }
}
```

Then ask Codex to use `mod-dwarf-mcp` tools to inspect pedalboards, banks, snapshots, and plugins.

## ChatGPT MCP Usage

For ChatGPT clients that support custom MCP connectors, configure the command transport with:

```bash
node /absolute/path/to/mod-dwarf-mcp/dist/index.js
```

Set the same environment variables shown above. The server uses stdio transport.

## Development

```bash
npm run dev
npm run build
npm run lint
npm test
npm run format:check
```

Tests use mocks and fixtures only. They do not connect to a real MOD Dwarf.

## Project Structure

```text
mod-dwarf-mcp/
├── src/
│   ├── server/
│   ├── tools/
│   ├── services/
│   ├── clients/
│   ├── types/
│   ├── schemas/
│   └── index.ts
├── tests/
├── docs/
├── README.md
├── .env.example
├── package.json
└── tsconfig.json
```

## License

MIT
