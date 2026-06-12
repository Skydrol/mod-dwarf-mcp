import type { CommandRunner } from "../clients/sshClient.js";
import type { DeviceInfo } from "../types/device.js";
import { lines, parseKernel, parseOsRelease } from "./parsers.js";
import { readFile } from "./sshUtils.js";

export class DeviceService {
  constructor(private readonly ssh: CommandRunner) {}

  async getDeviceInfo(): Promise<DeviceInfo> {
    const [
      firmware,
      controller,
      osRelease,
      uname,
      plugins,
      userPedalboards,
      factoryPedalboards,
      userLv2,
      systemLv2
    ] = await Promise.all([
      readFile(this.ssh, "/etc/mod-release/release"),
      readFile(this.ssh, "/usr/share/mod/controller/version"),
      readFile(this.ssh, "/etc/os-release"),
      this.ssh.exec("uname -a"),
      this.ssh.exec("lv2ls"),
      this.ssh.exec("find '/root/.pedalboards' -maxdepth 1 -type d -name '*.pedalboard' -print"),
      this.ssh.exec(
        "find '/usr/share/mod/pedalboards' -maxdepth 1 -type d -name '*.pedalboard' -print"
      ),
      this.ssh.exec("find '/root/.lv2' -maxdepth 1 -type d -print"),
      this.ssh.exec("find '/usr/lib/lv2' -maxdepth 1 -type d -print")
    ]);

    const kernel = parseKernel(uname.stdout);
    return {
      firmwareVersion: firmware?.trim() || null,
      controllerVersion: controller?.trim() || null,
      os: osRelease ? parseOsRelease(osRelease) : { name: null, version: null },
      kernel: kernel.kernel,
      architecture: kernel.architecture,
      counts: {
        lv2Plugins: lines(plugins.stdout).length,
        userPedalboards: lines(userPedalboards.stdout).length,
        factoryPedalboards: lines(factoryPedalboards.stdout).length,
        userLv2Bundles: Math.max(0, lines(userLv2.stdout).length - 1),
        systemLv2Bundles: Math.max(0, lines(systemLv2.stdout).length - 1)
      }
    };
  }
}
