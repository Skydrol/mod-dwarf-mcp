import { describe, expect, it } from "vitest";
import { pluginCatalog } from "../src/data/pluginCatalog.js";
import { PluginService } from "../src/services/pluginService.js";
import { EffectRecipeToPedalboardPlanService } from "../src/services/effectRecipeToPedalboardPlanService.js";
import { createPedalboardFromRecipeTool } from "../src/tools/createPedalboardFromRecipe.js";
import { effectRecipeSchema } from "../src/schemas/tools.js";

describe("effectRecipeSchema", () => {
  it("accepts a structured recipe", () => {
    const parsed = effectRecipeSchema.parse({
      song: "Example Song",
      artist: "Example Artist",
      instrument: "guitar",
      operationMode: "replace_current_board",
      effects: [{ role: "drive", character: "tight, mid-forward distortion", intensity: "medium" }],
      snapshots: [
        {
          name: "Verse",
          description: "Dry verse tone",
          effectFocus: { drive: "medium" }
        }
      ],
      sections: [{ name: "Verse", snapshot: "Verse" }]
    });

    expect(parsed.instrument).toBe("guitar");
    expect(parsed.effects[0]?.intensity).toBe("medium");
  });

  it("rejects malformed recipes", () => {
    expect(() =>
      effectRecipeSchema.parse({
        instrument: "guitar",
        operationMode: "replace_current_board",
        effects: [],
        snapshots: [],
        sections: []
      })
    ).toThrow();
  });
});

describe("EffectRecipeToPedalboardPlanService", () => {
  it("converts a recipe into a pedalboard plan and reuses snapshots once", async () => {
    const pluginService = new PluginService(null, pluginCatalog, null);
    const converter = new EffectRecipeToPedalboardPlanService(
      pluginService,
      { load: async () => null } as never,
      { resolve: async () => ({ parameterRanges: {}, warnings: [], unsupportedIdeas: [], valid: true }) } as never,
      { adjustPlan: (plan: never) => ({ adjustedPlan: plan, warnings: [], adjustments: [] }) } as never
    );

    const plan = await converter.convert({
      song: "Example Song",
      artist: "Example Artist",
      instrument: "guitar",
      operationMode: "modify_current_board",
      effects: [
        { role: "drive", character: "tight distortion", intensity: "strong" },
        { role: "modulation", character: "wide chorus", intensity: "subtle" }
      ],
      snapshots: [
        { name: "Verse", description: "Verse tone", effectFocus: { drive: "medium" } },
        { name: "Chorus", description: "Chorus tone", effectFocus: { modulation: "wide" } }
      ],
      sections: [
        { name: "Verse 1", snapshot: "Verse" },
        { name: "Verse 2", snapshot: "Verse" },
        { name: "Chorus", snapshot: "Chorus" }
      ]
    });

    expect(plan.operationMode).toBe("modify_current_board");
    expect(plan.signalChain.map((plugin) => plugin.role)).toEqual([
      "drive",
      "modulation"
    ]);
    expect(plan.snapshots.map((snapshot) => snapshot.name)).toEqual(["Verse", "Chorus"]);
    expect(plan.notes.join("\n")).toContain("reuses snapshot 'Verse'");
  });

  it("maps Elephant-style recipes to fuzz drive and cabinet without ambient effects", async () => {
    const pluginService = new PluginService(null, pluginCatalog, null);
    const converter = new EffectRecipeToPedalboardPlanService(
      pluginService,
      { load: async () => null } as never,
      { resolve: async () => ({ parameterRanges: {}, warnings: [], unsupportedIdeas: [], valid: true }) } as never,
      { adjustPlan: (plan: never) => ({ adjustedPlan: plan, warnings: [], adjustments: [] }) } as never
    );

    const plan = await converter.convert({
      song: "Elephant",
      artist: "Tame Impala",
      instrument: "guitar",
      operationMode: "replace_current_board",
      effects: [
        { role: "fuzz", character: "dry, aggressive fuzz", intensity: "strong" },
        { role: "drive", character: "tight amp-like push", intensity: "medium" },
        { role: "cabinet", character: "dry cabinet character", intensity: "subtle" }
      ],
      snapshots: [
        { name: "Main Riff", description: "Dry, aggressive core riff", effectFocus: { fuzz: "strong", drive: "medium" } },
        { name: "Lead", description: "Slightly lifted lead voice", effectFocus: { fuzz: "strong", drive: "medium", cabinet: "tight" } }
      ],
      sections: [
        { name: "Rhythm", snapshot: "Main Riff" },
        { name: "Lead", snapshot: "Lead" },
        { name: "Lead 2", snapshot: "Lead" }
      ]
    });

    expect(plan.signalChain.map((plugin) => plugin.role)).toEqual([
      "fuzz",
      "drive",
      "cabinet"
    ]);
    expect(plan.signalChain.map((plugin) => plugin.name)).toEqual([
      "Open Big Muff",
      "GxTubeScreamer",
      "Vintage Cabinets"
    ]);
    expect(plan.snapshots.map((snapshot) => snapshot.name)).toEqual(["Main Riff", "Lead"]);
    expect(plan.notes.join("\n")).toContain("Section 'Lead 2' reuses snapshot 'Lead'.");
  });
});

describe("createPedalboardFromRecipeTool", () => {
  it("does not write when confirm=false", async () => {
    const response = await createPedalboardFromRecipeTool(
      {
        recipe: {
          instrument: "guitar",
          operationMode: "replace_current_board",
          effects: [{ role: "drive", character: "distortion" }],
          snapshots: [],
          sections: []
        },
        confirm: false
      },
      {
        effectRecipeToPedalboardPlanService: undefined as never,
        executePedalboardPlanService: undefined as never
      } as never
    );

    const parsed = JSON.parse(response.content[0].text) as { confirmed: boolean };
    expect(parsed.confirmed).toBe(false);
  });

  it("delegates to ExecutePedalboardPlanService when confirm=true", async () => {
    let capturedPlan: unknown = null;
    let capturedConfirm = false;
    let capturedTitle: string | undefined;

    const response = await createPedalboardFromRecipeTool(
      {
        recipe: {
          instrument: "guitar",
          operationMode: "replace_current_board",
          effects: [{ role: "drive", character: "distortion" }],
          snapshots: [{ name: "Base", description: "Base", effectFocus: { drive: "medium" } }],
          sections: [{ name: "Main", snapshot: "Base" }]
        },
        confirm: true,
        title: "RecipeBoard"
      },
      {
        effectRecipeToPedalboardPlanService: { convert: async () => ({}) } as never,
        executePedalboardPlanService: {
          execute: async (input: { plan: unknown; confirm: boolean; title?: string }) => {
            capturedPlan = input.plan;
            capturedConfirm = input.confirm;
            capturedTitle = input.title;
            return { ok: true };
          }
        }
      } as never
    );

    expect(JSON.parse(response.content[0].text)).toEqual({ ok: true });
    expect(capturedConfirm).toBe(true);
    expect(capturedTitle).toBe("RecipeBoard");
    expect(capturedPlan).not.toBeNull();
  });
});
