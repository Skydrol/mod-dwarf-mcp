import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LiveParameterService } from "../src/services/liveParameterService.js";
import { parseLv2InfoPorts } from "../src/services/parsers.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures");

describe("LiveParameterService", () => {
  it("resolves a safe parameter value from real lv2info metadata", () => {
    const service = new LiveParameterService();
    const ports = parseLv2InfoPorts(
      readFileSync(join(fixtureRoot, "lv2/lv2info/gain.txt"), "utf8"),
      "http://moddevices.com/plugins/mod-devel/Gain"
    );

    const result = service.resolveParameterPlans("Gain", ports, {
      Gain: { min: -12, max: 6, unit: "dB" }
    });

    expect(result.errors).toEqual([]);
    expect(result.parameterPlans).toHaveLength(1);
    expect(result.parameterPlans[0].symbol).toBe("Gain");
    expect(result.parameterPlans[0].minimum).toBe(-40);
    expect(result.parameterPlans[0].maximum).toBe(40);
    expect(result.parameterPlans[0].value).toBe(-6);
  });

  it("rejects unknown parameter symbols", () => {
    const service = new LiveParameterService();
    const ports = parseLv2InfoPorts(
      readFileSync(join(fixtureRoot, "lv2/lv2info/gain.txt"), "utf8"),
      "http://moddevices.com/plugins/mod-devel/Gain"
    );

    const result = service.resolveParameterPlans("Gain", ports, {
      NotAPort: { min: -12, max: 6 }
    });

    expect(result.parameterPlans).toEqual([]);
    expect(result.errors[0]).toContain("NotAPort");
  });

  it("rejects out-of-range values", () => {
    const service = new LiveParameterService();
    const validation = service.validateParameterPlan("/graph/gain_1", {
      requestedKey: "gain",
      symbol: "Gain",
      name: "Gain",
      minimum: -40,
      maximum: 40,
      default: 0,
      unit: "dB",
      properties: [],
      requestedRange: { min: -12, max: 6, unit: "dB" },
      resolvedRange: { min: -12, max: 6, unit: "dB" },
      value: 100
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain("outside");
  });

  it("builds the exact UI-compatible parameter payload", () => {
    const service = new LiveParameterService();
    const call = service.buildParameterCall("gain_1", {
      requestedKey: "Gain",
      symbol: "Gain",
      name: "Gain",
      minimum: -40,
      maximum: 40,
      default: 0,
      unit: "dB",
      properties: [],
      requestedRange: { min: -12, max: 6, unit: "dB" },
      resolvedRange: { min: -12, max: 6, unit: "dB" },
      value: -6
    });

    expect(call.path).toBe("/effect/parameter/set/");
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({
      kind: "json",
      value: "/graph/gain_1/Gain/-6"
    });
  });
});
