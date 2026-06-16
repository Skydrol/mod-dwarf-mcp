import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { DeviceInventoryService } from "../src/services/deviceInventoryService.js";
import type { CommandResult, CommandRunner } from "../src/clients/sshClient.js";
import { MockRunner } from "./mockRunner.js";

describe("DeviceInventoryService", () => {
  it("generates a sorted inventory and writes it to disk", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "mod-dwarf-inventory-"));
    const service = new DeviceInventoryService(
      new MockRunner(),
      join(outputDir, "inventory.json"),
      join(outputDir, "pluginKnowledgeDb.json")
    );

    const result = await service.refresh();

    expect(result.pluginCount).toBe(2);
    expect(result.newInventoryWritten).toBe(true);
    expect(result.inventoryPath).toBe(join(outputDir, "inventory.json"));
    expect(result.knowledgeDbWritten).toBe(true);
    expect(result.knowledgeDbPath).toBe(join(outputDir, "pluginKnowledgeDb.json"));

    const raw = await readFile(join(outputDir, "inventory.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      generatedAt: string;
      device: { firmware: string | null; os: string | null; kernel: string | null };
      plugins: Array<{
        name: string;
        uri: string;
        audioInputs: number;
        audioOutputs: number;
        controlPorts: Array<{ symbol: string; direction: string }>;
      }>;
    };

    expect(parsed.device.firmware).toBe("v1.13.5.3315");
    expect(parsed.device.os).toBe("Buildroot 2016.02");
    expect(parsed.device.kernel).toBe("Linux moddwarf 6.1.15-rt7-moddwarf");
    expect(parsed.plugins.map((plugin) => plugin.name)).toEqual(["Gain", "MVerb"]);
    expect(parsed.plugins[0].audioInputs).toBe(1);
    expect(parsed.plugins[0].audioOutputs).toBe(1);
    expect(parsed.plugins[0].controlPorts[0]).toMatchObject({ symbol: "Gain", name: "Gain" });

    const knowledgeRaw = await readFile(join(outputDir, "pluginKnowledgeDb.json"), "utf8");
    const knowledge = JSON.parse(knowledgeRaw) as {
      generatedAt: string;
      version: number;
      plugins: Array<{
        name: string;
        summary: { purpose: string; useWhen: string; differsFrom: string };
        roles: string[];
        warnings: string[];
      }>;
    };
    expect(knowledge.version).toBe(1);
    expect(knowledge.plugins.map((plugin) => plugin.name)).toEqual(["Gain", "MVerb"]);
    expect(knowledge.plugins[0].summary.purpose.length).toBeGreaterThan(0);
    expect(knowledge.plugins[0].roles.length).toBeGreaterThan(0);
  });

  it("handles an empty plugin list", async () => {
    const runner = new EmptyPluginRunner();
    const outputDir = await mkdtemp(join(tmpdir(), "mod-dwarf-inventory-empty-"));
    const service = new DeviceInventoryService(
      runner,
      join(outputDir, "inventory.json"),
      join(outputDir, "pluginKnowledgeDb.json")
    );

    const result = await service.refresh();

    expect(result.pluginCount).toBe(0);
    const raw = await readFile(join(outputDir, "inventory.json"), "utf8");
    const parsed = JSON.parse(raw) as { plugins: unknown[] };
    expect(parsed.plugins).toEqual([]);
  });

  it("keeps control port extraction stable", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "mod-dwarf-inventory-ports-"));
    const service = new DeviceInventoryService(
      new MockRunner(),
      join(outputDir, "inventory.json"),
      join(outputDir, "pluginKnowledgeDb.json")
    );
    const result = await service.refresh();
    const raw = await readFile(join(outputDir, "inventory.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      plugins: Array<{
        name: string;
        controlPorts: Array<{
          symbol: string;
          name: string | null;
          minimum: number | null;
          maximum: number | null;
          default: number | null;
          unit: string | null;
          direction: string;
        }>;
      }>;
    };
    const gain = parsed.plugins.find((plugin) => plugin.name === "Gain");
    expect(gain?.controlPorts[0]).toMatchObject({
      symbol: "Gain",
      name: "Gain",
      minimum: -40,
      maximum: 40,
      default: null,
      unit: null,
      direction: "input"
    });
    expect(result.pluginCount).toBeGreaterThan(0);
  });
});

class EmptyPluginRunner implements CommandRunner {
  async exec(command: string): Promise<CommandResult> {
    if (command === "lv2ls" || command === "lv2ls -n") return { stdout: "", stderr: "", code: 0 };
    if (command === "uname -a")
      return {
        stdout:
          "Linux moddwarf 6.1.15-rt7-moddwarf #6 SMP PREEMPT_RT Mon Oct 7 16:24:37 UTC 2024 aarch64 GNU/Linux\n",
        stderr: "",
        code: 0
      };
    if (command === "cat /etc/mod-release/release")
      return { stdout: "v1.13.5.3315\n", stderr: "", code: 0 };
    if (command === "cat /etc/os-release")
      return { stdout: "NAME=Buildroot\nVERSION=2016.02\n", stderr: "", code: 0 };
    return { stdout: "", stderr: "", code: 1 };
  }
}
