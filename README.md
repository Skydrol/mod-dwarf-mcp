# mod-dwarf-mcp

MCP server for the MOD Dwarf pedalboard platform.

The server inspects a MOD Dwarf over SSH and HTTP. It is primarily a read-only inspection tool, but includes write-gated, opt-in tools for pedalboard generation and management that are disabled by default. For prompt-driven creation, `create_pedalboard_from_prompt` is the recommended entry point.

## How To Use

### First Connection

On first use with a connected MOD Dwarf:

1. Call `get_device_info`.
2. Call `list_plugins`.
3. Treat the discovered plugins as the source of truth for what is physically installed.
4. Optionally call `refresh_device_inventory` to write the local inventory files for reuse in the session.

### Prompt-Driven Creation

For a user prompt like "Smells Like Teen Spirit":

1. Translate the request to English before interpreting it if the user wrote in another language.
2. Decide the effect list and change list yourself.
3. Research the target tone if the prompt depends on song-specific or artist-specific references.
4. Discover installed plugins with `list_plugins`.
5. Cross your own effect list against the installed plugins and adapt it to the device.
6. Use `create_pedalboard_from_prompt` to build and save the board.

### Recipe-Driven Creation

When the caller already has a structured recipe:

1. Build an `EffectRecipe` with the target song, instrument, effects, snapshots, and sections.
2. Use `create_pedalboard_from_recipe` to convert the recipe into a pedalboard plan.
3. The tool reuses the existing execution flow and saves through the same HTTP path as other write tools.

The detailed workflow is documented in [`docs/MCP_MANUAL.md`](docs/MCP_MANUAL.md).

## Features

- `get_device_info`: firmware, OS, kernel, plugin counts, pedalboard counts
- `list_plugins`: installed LV2 plugins by name, URI, or both
- `list_pedalboards`: user and factory pedalboard bundles
- `inspect_pedalboard`: bundle structure, plugins used, connections, mappings, snapshots, metadata
- `list_banks`: user and factory banks
- `list_snapshots`: snapshots for one pedalboard
- `plan_pedalboard_from_prompt`: dry-run pedalboard plan using installed plugins only
- `create_pedalboard_dry_bundle`: generate a local temporary LV2 pedalboard bundle from a plan; uploads nothing
- `create_pedalboard_from_prompt`: end-to-end prompt execution path that generates, imports, saves, and reports
- `create_pedalboard_from_recipe`: structured recipe entry point that converts an `EffectRecipe` into a plan, then executes it through the same HTTP path
- `execute_pedalboard_plan`: lower-level end-to-end executor for an already planned board
- `create_new_pedalboard`: write-gated quick path that resets the active board and saves it as a new empty pedalboard
- `refresh_device_inventory`: first-connection inventory scan that writes the local inventory files
- `import_pedalboard_dry_bundle`: write-gated MOD UI API import/load for a generated dry bundle; disabled by default
- `save_loaded_pedalboard_as_new`: write-gated persistent save of the currently loaded pedalboard using `/pedalboard/save` with `asNew=1`
- `load_existing_pedalboard`: write-gated load of an existing saved bundle using `/pedalboard/load_bundle/`; does not save or call `/banks/save`

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

Phase 1 is read-only by design. Phase 2 adds planning only. Phase 3A can write generated files only to a local temporary directory on the MCP host; it does not upload to the MOD Dwarf, call MOD APIs, or modify device pedalboards. Phase 3B adds write-gated import/load and save tools that are disabled unless `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and the tool input includes `confirm=true`. They use MOD UI API endpoints only, return every API call attempted, and never fall back to direct file writes. `create_pedalboard_from_prompt` and `execute_pedalboard_plan` drive the full HTTP creation flow; `create_new_pedalboard` is the fast empty-board helper, `save_loaded_pedalboard_as_new` refuses to run if the target title already exists and never calls `/banks/save`, and `load_existing_pedalboard` requires an existing bundle path, calls only `/pedalboard/load_bundle/`, and never calls `/pedalboard/save` or `/banks/save`.

If the user's prompt is in a language other than English, translate it to English before deciding the MCP inputs.

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

### create_pedalboard_from_prompt

Recommended end-to-end path for prompt-driven board creation. It builds a plan, generates a bundle with snapshots, imports it through MOD HTTP endpoints, saves it as a new pedalboard, and writes a final report under `final_reports/`.

```json
{
  "plan": {
    "dryRun": true,
    "operationMode": "replace_current_board",
    "safety": {
      "writesFiles": false,
      "modifiesDevice": false,
      "callsPostEndpoints": false
    },
    "request": {
      "style": "Smells Like Teen Spirit",
      "instrument": "guitar",
      "goals": ["Nirvana tone", "verse chorus snapshots", "grunge crunch"],
      "referenceArtists": ["Nirvana"]
    },
    "template": null,
    "availablePluginCount": 265,
    "signalChain": [],
    "snapshots": [],
    "notes": [],
    "unsupportedIdeas": []
  },
  "confirm": true,
  "title": "TeenSpiritFinal"
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

### save_loaded_pedalboard_as_new

Write-gated persistent save for the currently loaded pedalboard. Requires `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and `confirm: true`. It checks `list_pedalboards` before saving, refuses existing titles, calls `POST /pedalboard/save` with `title` and `asNew=1`, confirms the new title appears afterward, logs every API call, and never calls `/banks/save`.

```json
{
  "title": "AI_TEST_DO_NOT_USE",
  "confirm": true
}
```

### load_existing_pedalboard

Write-gated load for an existing saved pedalboard bundle. Requires `MOD_DWARF_ENABLE_WRITE_TOOLS=true` and `confirm: true`. It verifies the bundle path is listed first, then calls `POST /pedalboard/load_bundle/` with `bundlepath`. It never calls `/pedalboard/save` or `/banks/save`.

```json
{
  "bundlePath": "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard",
  "confirm": true
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

For prompt-driven creation, follow the workflow in [`docs/MCP_MANUAL.md`](docs/MCP_MANUAL.md): discover installed plugins first, decide the effect list and snapshots explicitly, then call `create_pedalboard_from_prompt`.
For structured recipes, prefer `create_pedalboard_from_recipe` and keep the recipe explicit about sections and snapshot reuse.

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
