import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandResult, CommandRunner } from "../src/clients/sshClient.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures");

export class MockRunner implements CommandRunner {
  public commands: string[] = [];

  async exec(command: string): Promise<CommandResult> {
    this.commands.push(command);

    if (command === "lv2ls") return ok(readFixture("lv2/lv2ls-uris.txt"));
    if (command === "lv2ls -n") return ok(readFixture("lv2/lv2ls-names.txt"));
    if (command.startsWith("lv2info ")) return lv2InfoCommand(command);
    if (command === "uname -a")
      return ok(
        "Linux moddwarf 6.1.15-rt7-moddwarf #6 SMP PREEMPT_RT Mon Oct 7 16:24:37 UTC 2024 aarch64 GNU/Linux\n"
      );

    if (command.startsWith("cat ")) return catCommand(command);
    if (command.startsWith("test -f ")) return testFileCommand(command);
    if (command.includes("Dave.pedalboard") && command.includes("*.ttl"))
      return ok("/root/.pedalboards/Dave.pedalboard/Dave.ttl\n");
    if (command.includes("/root/.pedalboards") && command.startsWith("find ")) {
      if (command.includes("-maxdepth 1")) {
        return ok(
          [
            "/root/.pedalboards/Dave.pedalboard",
            "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard"
          ].join("\n") + "\n"
        );
      }
      return ok(
        [
          "/root/.pedalboards/Dave.pedalboard",
          "/root/.pedalboards/Dave.pedalboard/manifest.ttl",
          "/root/.pedalboards/Dave.pedalboard/Dave.ttl",
          "/root/.pedalboards/Dave.pedalboard/snapshots.json",
          "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard",
          "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard/manifest.ttl",
          "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard/AI_TEST_DO_NOT_U.ttl",
          "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard/snapshots.json",
          "/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard/addressings.json"
        ].join("\n") + "\n"
      );
    }
    if (command.includes("/usr/share/mod/pedalboards") && command.startsWith("find "))
      return ok("/usr/share/mod/default.pedalboard\n");
    if (command.includes("/root/.lv2") && command.startsWith("find "))
      return ok("/root/.lv2\n/root/.lv2/Gain.lv2\n");
    if (command.includes("/usr/lib/lv2") && command.startsWith("find "))
      return ok("/usr/lib/lv2\n/usr/lib/lv2/mod.lv2\n");
    return { stdout: "", stderr: `Unhandled mock command: ${command}`, code: 1 };
  }
}

function ok(stdout: string): CommandResult {
  return { stdout, stderr: "", code: 0 };
}

function readFixture(relativePath: string): string {
  return readFileSync(join(fixtureRoot, relativePath), "utf8");
}

function unquotePath(command: string): string {
  const match = command.match(/'(.+)'/);
  return match ? match[1].replace(/'"'"'/g, "'") : (command.split(/\s+/).at(-1) ?? "");
}

function mapDevicePath(path: string): string | null {
  if (path === "/etc/mod-release/release") return null;
  if (path === "/usr/share/mod/controller/version") return null;
  if (path === "/etc/os-release") return null;
  if (path === "/root/data/banks.json") return join(fixtureRoot, "banks/user-banks.json");
  if (path === "/usr/share/mod/banks.json") return join(fixtureRoot, "banks/factory-banks.json");
  if (path.startsWith("/root/.pedalboards/Dave.pedalboard")) {
    return join(
      fixtureRoot,
      "pedalboards/Dave.pedalboard",
      path.replace("/root/.pedalboards/Dave.pedalboard/", "")
    );
  }
  if (path.startsWith("/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard")) {
    return join(
      fixtureRoot,
      "pedalboards/AI_TEST_DO_NOT_U.pedalboard",
      path.replace("/root/.pedalboards/AI_TEST_DO_NOT_U.pedalboard/", "")
    );
  }
  return null;
}

function lv2InfoCommand(command: string): CommandResult {
  const uri = unquotePath(command);
  if (uri === "http://moddevices.com/plugins/mod-devel/Gain") {
    return ok(readFixture("lv2/lv2info/gain.txt"));
  }
  if (uri === "http://distrho.sf.net/plugins/MVerb") {
    return ok(readFixture("lv2/lv2info/mverb.txt"));
  }
  return { stdout: "", stderr: "missing lv2info fixture", code: 1 };
}

function catCommand(command: string): CommandResult {
  const path = unquotePath(command);
  if (path === "/etc/mod-release/release") return ok("v1.13.5.3315\n");
  if (path === "/usr/share/mod/controller/version") return ok("controller-hash\n");
  if (path === "/etc/os-release") return ok("NAME=Buildroot\nVERSION=2016.02\n");
  const mapped = mapDevicePath(path);
  if (!mapped) return { stdout: "", stderr: "missing", code: 1 };
  try {
    return ok(readFileSync(mapped, "utf8"));
  } catch {
    return { stdout: "", stderr: "missing", code: 1 };
  }
}

function testFileCommand(command: string): CommandResult {
  const path = unquotePath(command);
  const mapped = mapDevicePath(path);
  if (!mapped) return { stdout: "", stderr: "", code: 1 };
  try {
    readFileSync(mapped);
    return ok("");
  } catch {
    return { stdout: "", stderr: "", code: 1 };
  }
}
