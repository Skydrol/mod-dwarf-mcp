import { describe, expect, it } from "vitest";
import { pluginCatalog } from "../src/data/pluginCatalog.js";

const AIDA_X_URI = "http://aidadsp.cc/plugins/aidadsp-bundle/rt-neural-generic";

function entry(name: string) {
  return pluginCatalog.find((p) => p.name === name);
}

describe("plugin catalog classification", () => {
  it("AIDA-X has category amp_and_cab_modeler", () => {
    const plugin = entry("AIDA-X");
    expect(plugin?.category).toBe("amp_and_cab_modeler");
  });

  it("AIDA-X requiresExternalModel is true", () => {
    const plugin = entry("AIDA-X");
    expect(plugin?.requiresExternalModel).toBe(true);
  });

  it("AIDA-X avoidForRoles includes distortion", () => {
    const plugin = entry("AIDA-X");
    expect(plugin?.avoidForRoles).toContain("distortion");
  });

  it("AIDA-X avoidForRoles includes overdrive", () => {
    const plugin = entry("AIDA-X");
    expect(plugin?.avoidForRoles).toContain("overdrive");
  });

  it("AIDA-X avoidForRoles includes fuzz", () => {
    const plugin = entry("AIDA-X");
    expect(plugin?.avoidForRoles).toContain("fuzz");
  });

  it("DS1 has category distortion", () => {
    expect(entry("DS1")?.category).toBe("distortion");
  });

  it("MetalTone has category distortion", () => {
    expect(entry("MetalTone")?.category).toBe("distortion");
  });

  it("Open Big Muff has category fuzz", () => {
    expect(entry("Open Big Muff")?.category).toBe("fuzz");
  });

  it("GxTubeScreamer has category overdrive", () => {
    expect(entry("GxTubeScreamer")?.category).toBe("overdrive");
  });

  it("GxSD1 has category overdrive", () => {
    expect(entry("GxSD1")?.category).toBe("overdrive");
  });

  it("CollisionDrive has category overdrive", () => {
    expect(entry("CollisionDrive")?.category).toBe("overdrive");
  });

  it("ChowCentaur has category boost", () => {
    expect(entry("ChowCentaur")?.category).toBe("boost");
  });

  it("GxBooster has category boost", () => {
    expect(entry("GxBooster")?.category).toBe("boost");
  });

  it("Vintage Cabinets has category cabinet", () => {
    expect(entry("Vintage Cabinets")?.category).toBe("cabinet");
  });

  it("Bollie Delay has category delay", () => {
    expect(entry("Bollie Delay")?.category).toBe("delay");
  });

  it("Dragonfly Hall Reverb has category reverb", () => {
    expect(entry("Dragonfly Hall Reverb")?.category).toBe("reverb");
  });

  it("MVerb has category reverb", () => {
    expect(entry("MVerb")?.category).toBe("reverb");
  });

  it("TAP Chorus/Flanger has category modulation", () => {
    expect(entry("TAP Chorus/Flanger")?.category).toBe("modulation");
  });

  it("Gain 2x2 has category gain", () => {
    expect(entry("Gain 2x2")?.category).toBe("gain");
  });

  it("GxCompressor has category utility", () => {
    expect(entry("GxCompressor")?.category).toBe("utility");
  });

  it("Noise Gate has category utility", () => {
    expect(entry("Noise Gate")?.category).toBe("utility");
  });

  it("TAP Tubewarmth has category overdrive", () => {
    expect(entry("TAP Tubewarmth")?.category).toBe("overdrive");
  });

  it("TAP Sigmoid Booster has category boost", () => {
    expect(entry("TAP Sigmoid Booster")?.category).toBe("boost");
  });

  it("no dedicated distortion plugin has requiresExternalModel", () => {
    const distortionPlugins = pluginCatalog.filter(
      (p) => p.category === "distortion" || p.category === "fuzz" || p.category === "overdrive"
    );
    for (const plugin of distortionPlugins) {
      expect(plugin.requiresExternalModel ?? false, `${plugin.name} should not requireExternalModel`).toBe(false);
    }
  });

  it("AIDA-X uri is stable and present", () => {
    const plugin = pluginCatalog.find((p) => p.uri === AIDA_X_URI);
    expect(plugin).toBeDefined();
    expect(plugin?.name).toBe("AIDA-X");
  });

  it("all amp_modeler and amp_and_cab_modeler plugins have requiresExternalModel", () => {
    const modelers = pluginCatalog.filter(
      (p) => p.category === "amp_modeler" || p.category === "amp_and_cab_modeler"
    );
    expect(modelers.length).toBeGreaterThan(0);
    for (const plugin of modelers) {
      expect(plugin.requiresExternalModel, `${plugin.name} should requireExternalModel`).toBe(true);
    }
  });

  it("every entry in avoidForRoles is a valid semantic category name", () => {
    const validRoles = new Set([
      "boost", "overdrive", "distortion", "fuzz",
      "amp_modeler", "cabinet", "amp_and_cab_modeler",
      "modulation", "delay", "reverb", "utility", "gain"
    ]);
    for (const plugin of pluginCatalog) {
      for (const avoided of plugin.avoidForRoles ?? []) {
        expect(validRoles.has(avoided), `${plugin.name} avoidForRoles "${avoided}" is not a valid category`).toBe(true);
      }
    }
  });
});
