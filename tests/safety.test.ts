import { describe, expect, it } from "vitest";
import { DryBundleService } from "../src/services/dryBundleService.js";
import { PluginService } from "../src/services/pluginService.js";
import { MockRunner } from "./mockRunner.js";

describe("DryBundleService Safety Checks", () => {
  it("throws if metadata is missing for a plugin", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new DryBundleService(pluginService);

    // We mock exec to return empty output for a specific URI
    const originalExec = runner.exec.bind(runner);
    runner.exec = async (command: string) => {
      if (command.includes("http://moddevices.com/plugins/mod-devel/Gain")) {
        return { stdout: "", stderr: "", code: 0 };
      }
      return originalExec(command);
    };

    const plan = {
      dryRun: true,
      request: { style: "clean", instrument: "guitar", goals: ["gain"] },
      signalChain: [
        {
          role: "gain",
          name: "Gain",
          uri: "http://moddevices.com/plugins/mod-devel/Gain",
          suggestedInstance: "gain",
          parameterRanges: {}
        }
      ],
      snapshots: [],
      notes: [],
      unsupportedIdeas: [],
      availablePluginCount: 1
    } as any;

    await expect(service.createDryBundle(plan)).rejects.toThrow("Metadata missing for plugin");
  });

  it("throws if audio ports are missing", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new DryBundleService(pluginService);

    // Mock lv2info to return something with NO audio ports
    const originalExec = runner.exec.bind(runner);
    runner.exec = async (command: string) => {
      if (command.includes("http://moddevices.com/plugins/mod-devel/Gain")) {
        return { stdout: "Port 0:\n  Symbol: foo\n  Type: ControlPort\n", stderr: "", code: 0 };
      }
      return originalExec(command);
    };

    const plan = {
      dryRun: true,
      request: { style: "clean", instrument: "guitar", goals: ["gain"] },
      signalChain: [
        {
          role: "gain",
          name: "Gain",
          uri: "http://moddevices.com/plugins/mod-devel/Gain",
          suggestedInstance: "gain",
          parameterRanges: {}
        }
      ],
      snapshots: [],
      notes: [],
      unsupportedIdeas: [],
      availablePluginCount: 1
    } as any;

    await expect(service.createDryBundle(plan)).rejects.toThrow("Plugin has no audio inputs");
  });

  it("throws if a planned parameter does not exist", async () => {
    const runner = new MockRunner();
    const pluginService = new PluginService(runner);
    const service = new DryBundleService(pluginService);

    const plan = {
      dryRun: true,
      request: { style: "clean", instrument: "guitar", goals: ["gain"] },
      signalChain: [
        {
          role: "gain",
          name: "Gain",
          uri: "http://moddevices.com/plugins/mod-devel/Gain",
          suggestedInstance: "gain",
          parameterRanges: {
            NonExistentParam: { min: 0, max: 1 }
          }
        }
      ],
      snapshots: [],
      notes: [],
      unsupportedIdeas: [],
      availablePluginCount: 1
    } as any;

    await expect(service.createDryBundle(plan)).rejects.toThrow(
      "Parameter 'NonExistentParam' not found on plugin"
    );
  });
});
