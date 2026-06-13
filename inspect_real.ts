import { createClients } from "./src/clients/modDwarfClient.js";
import { loadEnv } from "./src/schemas/env.js";

async function main() {
  const config = loadEnv();
  const clients = createClients(config);

  const res = await clients.ssh.exec("find /root/.pedalboards -name manifest.ttl | head -n 1");
  const manifestPath = res.stdout.trim();
  console.log('Manifest Path:', manifestPath);
  
  if (manifestPath) {
    const res2 = await clients.ssh.exec(`cat ${manifestPath}`);
    console.log('--- manifest.ttl ---');
    console.log(res2.stdout);
    
    const bundleDir = manifestPath.substring(0, manifestPath.lastIndexOf('/'));
    const mainTtlMatch = res2.stdout.match(/rdfs:seeAlso\s+<([^>]+)>/);
    if (mainTtlMatch) {
        const mainTtlPath = `${bundleDir}/${mainTtlMatch[1]}`;
        console.log('Main TTL Path:', mainTtlPath);
        const res3 = await clients.ssh.exec(`cat ${mainTtlPath}`);
        console.log('--- main ttl ---');
        console.log(res3.stdout);
    }
  }
}

main().catch(console.error);
