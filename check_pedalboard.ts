import { createClients } from "./src/clients/modDwarfClient.js";
import { loadEnv } from "./src/schemas/env.js";
import { PedalboardService } from "./src/services/pedalboardService.js";

async function main() {
  const config = loadEnv();
  const clients = createClients(config);
  const ps = new PedalboardService(clients.ssh);
  const list = await ps.listPedalboards('user');
  console.log(JSON.stringify(list.user.filter(p => p.title === 'AI_PORT_FIX_REAL_01'), null, 2));
}

main().catch(console.error);
