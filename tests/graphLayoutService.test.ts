import { describe, expect, it } from "vitest";
import { GraphLayoutService } from "../src/services/graphLayoutService.js";

function plugin(
  role: string,
  name: string,
  uri = `urn:test:${name.toLowerCase().replace(/\s+/g, "-")}`
) {
  return { role, name, uri };
}

describe("GraphLayoutService", () => {
  it("lays out a linear chain from left to right across the lane grid", () => {
    const service = new GraphLayoutService();
    const layout = service.layoutPlugins([
      plugin("input gain", "Gain"),
      plugin("dynamics", "ZamComp"),
      plugin("modulation", "TAP Chorus/Flanger"),
      plugin("delay", "Bollie Delay"),
      plugin("output level", "Gain 2x2")
    ]);

    expect(layout.map(({ x }) => x)).toEqual([120, 940, 1760, 2580, 3400]);
    expect(layout.map(({ y }) => y)).toEqual([260, 300, 380, 500, 860]);
  });

  it("lays out a Let It Happen style chain in distinct lanes", () => {
    const service = new GraphLayoutService();
    const layout = service.layoutPlugins([
      plugin("input gain", "Gain"),
      plugin("modulation", "TAP Chorus/Flanger"),
      plugin("delay", "Bollie Delay"),
      plugin("reverb", "Dragonfly Hall Reverb"),
      plugin("output level", "Gain 2x2")
    ]);

    expect(layout.map(({ lane }) => lane)).toEqual([
      "utility",
      "modulation",
      "time",
      "time",
      "output"
    ]);
    expect(layout.map(({ x }) => x)).toEqual([120, 940, 1760, 2580, 3400]);
    expect(layout[0].y).toBeLessThan(layout[1].y);
    expect(layout[1].y).toBeLessThan(layout[2].y);
    expect(layout[3].y).toBeGreaterThan(layout[0].y);
    expect(layout[3].y).toBeGreaterThanOrEqual(layout[2].y);
    expect(layout[4].y).toBeGreaterThan(layout[0].y);
  });

  it("keeps high-gain nodes on validated drive and output lanes", () => {
    const service = new GraphLayoutService();
    const layout = service.layoutPlugins([
      plugin("input gain", "Gain"),
      plugin("high gain drive", "Neural Amp Modeler"),
      plugin("cabinet", "Cabinet Loader"),
      plugin("output level", "Gain 2x2")
    ]);

    expect(layout.map(({ lane }) => lane)).toEqual(["utility", "drive", "drive", "output"]);
    expect(layout.map(({ x }) => x)).toEqual([120, 940, 1760, 2580]);
  });

  it("does not overlap coordinates for a mixed chain", () => {
    const service = new GraphLayoutService();
    const layout = service.layoutPlugins([
      plugin("input gain", "Gain"),
      plugin("dynamics", "ZamComp"),
      plugin("modulation", "TAP Chorus/Flanger"),
      plugin("delay", "Bollie Delay"),
      plugin("reverb", "Dragonfly Hall Reverb"),
      plugin("output level", "Gain 2x2")
    ]);

    const coordinates = new Set(layout.map(({ x, y }) => `${x}:${y}`));
    expect(coordinates.size).toBe(layout.length);
  });

  it("returns stable deterministic output", () => {
    const service = new GraphLayoutService();
    const chain = [
      plugin("input gain", "Gain"),
      plugin("clean tone shaper", "GxCabinet"),
      plugin("modulation", "TAP Chorus/Flanger"),
      plugin("delay", "Bollie Delay"),
      plugin("reverb", "Dragonfly Hall Reverb"),
      plugin("output level", "Gain 2x2")
    ];

    expect(service.layoutPlugins(chain)).toEqual(service.layoutPlugins(chain));
  });
});
