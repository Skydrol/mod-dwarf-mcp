import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractConnections,
  extractMainTtlFromManifest,
  extractPluginsUsed,
  normalizeSnapshots,
  parseBanks
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

  it("parses banks", () => {
    const banks = parseBanks(readFileSync(join(fixtureRoot, "banks/user-banks.json"), "utf8"));
    expect(banks[0].title).toBe("User Bank");
    expect(banks[0].pedalboards[0].bundle).toBe("/root/.pedalboards/Dave.pedalboard");
  });
});
