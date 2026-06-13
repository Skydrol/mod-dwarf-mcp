import type { EnvConfig } from "../schemas/env.js";
import { HttpClient } from "./httpClient.js";
import { SshClient } from "./sshClient.js";
import { WriteHttpClient } from "./writeHttpClient.js";

export function createClients(config: EnvConfig): {
  ssh: SshClient;
  http: HttpClient;
  writeHttp: WriteHttpClient | null;
  writeToolsEnabled: boolean;
  websocketUrl: string;
} {
  return {
    ssh: new SshClient({
      host: config.MOD_DWARF_HOST,
      username: config.MOD_DWARF_SSH_USER,
      password: config.MOD_DWARF_SSH_PASSWORD,
      timeoutMs: config.MOD_DWARF_SSH_TIMEOUT_MS
    }),
    http: new HttpClient({
      host: config.MOD_DWARF_HOST,
      port: config.MOD_DWARF_PORT,
      timeoutMs: config.MOD_DWARF_HTTP_TIMEOUT_MS
    }),
    writeHttp: config.MOD_DWARF_ENABLE_WRITE_TOOLS
      ? new WriteHttpClient({
          host: config.MOD_DWARF_HOST,
          port: config.MOD_DWARF_PORT,
          timeoutMs: config.MOD_DWARF_HTTP_TIMEOUT_MS
        })
      : null,
    writeToolsEnabled: config.MOD_DWARF_ENABLE_WRITE_TOOLS,
    websocketUrl: `ws://${config.MOD_DWARF_HOST}:${config.MOD_DWARF_PORT}/websocket`
  };
}
