import type { CommandRunner } from "../clients/sshClient.js";
import type { PluginList, PluginPortInfo } from "../types/plugin.js";
import { lines, parseLv2InfoPorts } from "./parsers.js";
import { shellQuote } from "./sshUtils.js";

export class PluginService {
  constructor(private readonly ssh: CommandRunner) {}

  async listPlugins(format: "names" | "uris" | "both" = "both"): Promise<PluginList> {
    const [urisResult, namesResult] = await Promise.all([
      format === "names" ? Promise.resolve(null) : this.ssh.exec("lv2ls"),
      format === "uris" ? Promise.resolve(null) : this.ssh.exec("lv2ls -n")
    ]);

    const uris = urisResult ? lines(urisResult.stdout) : [];
    const names = namesResult ? lines(namesResult.stdout) : [];

    if (format === "uris") {
      return { count: uris.length, plugins: uris.map((uri) => ({ uri })) };
    }
    if (format === "names") {
      return { count: names.length, plugins: names.map((name) => ({ name })) };
    }

    const count = Math.max(uris.length, names.length);
    return {
      count,
      plugins: Array.from({ length: count }, (_, index) => ({
        name: names[index],
        uri: uris[index]
      }))
    };
  }

  async getPluginPorts(uri: string): Promise<PluginPortInfo> {
    const result = await this.ssh.exec(`lv2info ${shellQuote(uri)}`);
    if (result.code !== 0) {
      return { uri, ports: [], audioInputs: [], audioOutputs: [], controlInputs: [] };
    }
    return parseLv2InfoPorts(result.stdout, uri);
  }
}
