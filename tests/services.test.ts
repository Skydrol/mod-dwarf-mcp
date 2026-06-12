import { describe, expect, it } from "vitest";
import { BankService } from "../src/services/bankService.js";
import { DeviceService } from "../src/services/deviceService.js";
import { PedalboardService } from "../src/services/pedalboardService.js";
import { PluginService } from "../src/services/pluginService.js";
import { SnapshotService } from "../src/services/snapshotService.js";
import { MockRunner } from "./mockRunner.js";

describe("services with mocked SSH", () => {
  it("lists plugins without a real device", async () => {
    const service = new PluginService(new MockRunner());
    const result = await service.listPlugins("both");
    expect(result.count).toBe(2);
    expect(result.plugins[0].name).toBe("Gain");
  });

  it("gets device info from mocked commands", async () => {
    const service = new DeviceService(new MockRunner());
    const info = await service.getDeviceInfo();
    expect(info.firmwareVersion).toBe("v1.13.5.3315");
    expect(info.counts.lv2Plugins).toBe(2);
    expect(info.counts.userPedalboards).toBe(1);
  });

  it("lists banks", async () => {
    const service = new BankService(new MockRunner());
    const banks = await service.listBanks();
    expect(banks.user[0].title).toBe("User Bank");
    expect(banks.factory[0].title).toBe("Factory Bank");
  });

  it("lists snapshots", async () => {
    const service = new SnapshotService(new MockRunner());
    const snapshots = await service.listSnapshots("/root/.pedalboards/Dave.pedalboard");
    expect(snapshots.sourceFile).toBe("snapshots.json");
    expect(snapshots.snapshots[0].plugins).toEqual(["Gain"]);
  });

  it("inspects a pedalboard", async () => {
    const service = new PedalboardService(new MockRunner());
    const pedalboard = await service.inspectPedalboard("/root/.pedalboards/Dave.pedalboard");
    expect(pedalboard.title).toBe("Dave");
    expect(pedalboard.pluginsUsed[0].uri).toBe("http://moddevices.com/plugins/mod-devel/Gain");
    expect(pedalboard.snapshots[0].name).toBe("Default");
  });
});
