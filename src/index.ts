#!/usr/bin/env node
import { createClients } from "./clients/modDwarfClient.js";
import { loadEnv } from "./schemas/env.js";
import { runStdioServer } from "./server/mcpServer.js";

const config = loadEnv();
const clients = createClients(config);

await runStdioServer(clients);
