#!/usr/bin/env node
import { createClients } from "./clients/modDwarfClient.js";
import { loadEnv } from "./schemas/env.js";
import { runStdioServer } from "./server/mcpServer.js";
import { runCli } from "./cli/commands.js";

const config = loadEnv();
const clients = createClients(config);

const cliArgs = process.argv.slice(2);
if (cliArgs.length === 0) {
  await runStdioServer(clients);
} else {
  await runCli(cliArgs, config, clients);
}
