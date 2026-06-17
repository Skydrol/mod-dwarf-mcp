import { describe, expect, it } from "vitest";
import { pluginCatalog } from "../src/data/pluginCatalog.js";
import { PluginService } from "../src/services/pluginService.js";
import { PedalboardPlannerService } from "../src/services/pedalboardPlannerService.js";
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
    const pluginService = new PluginService(null, pluginCatalog);
    const planner = new PedalboardPlannerService(pluginService);
    const converter = new EffectRecipeToPedalboardPlanService(planner);

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
    expect(plan.signalChain.length).toBeGreaterThan(0);
    expect(plan.snapshots.map((snapshot) => snapshot.name)).toEqual(["Verse", "Chorus"]);
    expect(plan.notes.join("\n")).toContain("reuses snapshot 'Verse'");
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
        effectRecipeToPedalboardPlanService: {
          convert: async () =>
            ({
              dryRun: true,
              operationMode: "replace_current_board",
              safety: {
                writesFiles: false,
                modifiesDevice: false,
                callsPostEndpoints: false
              },
              request: {
                style: "recipe",
                instrument: "guitar",
                goals: ["drive: distortion"],
                referenceArtists: []
              },
              template: null,
              availablePluginCount: 1,
              signalChain: [],
              snapshots: [],
              notes: [],
              unsupportedIdeas: []
            }) as never
        },
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
