import { createClients } from "./src/clients/modDwarfClient.js";
import { loadEnv } from "./src/schemas/env.js";

async function main() {
  const config = loadEnv();
  const clients = createClients(config);

  const res = await clients.http.getJson(
    "/pedalboard/info/?bundlepath=%2Froot%2F.pedalboards%2FAI_PORT_FIX_REAL_01.pedalboard",
    "verify saved pedalboard"
  );
  console.log(JSON.stringify(res.value, null, 2));
}

main().catch(console.error);
