import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractConnections,
  extractMainTtlFromManifest,
  extractPluginsUsed,
  normalizeSnapshots,
  parseBanks,
  parseLv2InfoPorts
} from "../src/services/parsers.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures");

describe("parsers", () => {
  it("extracts main TTL from manifest", () => {
    const manifest = readFileSync(
      join(fixtureRoot, "pedalboards/Dave.pedalboard/manifest.ttl"),
      "utf8"
    );
    expect(extractMainTtlFromManifest(manifest)).toBe("Dave.ttl");
  });

  it("extracts plugins and connections from pedalboard TTL", () => {
    const ttl = readFileSync(join(fixtureRoot, "pedalboards/Dave.pedalboard/Dave.ttl"), "utf8");
    expect(extractPluginsUsed(ttl)).toEqual([
      { instance: "Gain", uri: "http://moddevices.com/plugins/mod-devel/Gain" }
    ]);
    expect(extractConnections(ttl)).toEqual([
      { tail: "capture_1", head: "Gain/In" },
      { tail: "Gain/Out", head: "playback_1" }
    ]);
  });

  it("normalizes snapshots.json", () => {
    const raw = JSON.parse(
      readFileSync(join(fixtureRoot, "pedalboards/Dave.pedalboard/snapshots.json"), "utf8")
    );
    const normalized = normalizeSnapshots(raw);
    expect(normalized.current).toBe(0);
    expect(normalized.snapshots[0].name).toBe("Default");
    expect(normalized.snapshots[0].portsByPlugin.Gain.Gain).toBe(0);
  });

  it("parses lv2info audio and control port symbols", () => {
    const info = parseLv2InfoPorts(
      readFileSync(join(fixtureRoot, "lv2/lv2info/mverb.txt"), "utf8"),
      "http://distrho.sf.net/plugins/MVerb"
    );
    expect(info.audioInputs.map((port) => port.symbol)).toEqual(["in1", "in2"]);
    expect(info.audioOutputs.map((port) => port.symbol)).toEqual(["out1", "out2"]);
    expect(info.controlInputs.map((port) => port.symbol)).toEqual([
      "mix",
      "decay",
      "low_cut",
      "high_cut"
    ]);
  });

  it("parses lv2info metadata with ranges", () => {
    const info = parseLv2InfoPorts(
      readFileSync(join(fixtureRoot, "lv2/lv2info/gain.txt"), "utf8"),
      "http://moddevices.com/plugins/mod-devel/Gain"
    );
    const gainPort = info.controlInputs.find((p) => p.symbol === "Gain");
    expect(gainPort?.minimum).toBe(-40);
    expect(gainPort?.maximum).toBe(40);
  });

  it("parses banks", () => {
    const banks = parseBanks(readFileSync(join(fixtureRoot, "banks/user-banks.json"), "utf8"));
    expect(banks[0].title).toBe("User Bank");
    expect(banks[0].pedalboards[0].bundle).toBe("/root/.pedalboards/Dave.pedalboard");
  });
});
