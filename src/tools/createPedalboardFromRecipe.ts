import { z } from "zod";
import { effectRecipeSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

const createPedalboardFromRecipeInputSchema = z
  .object({
    recipe: effectRecipeSchema,
    confirm: z.boolean(),
    title: z.string().min(1).optional()
  })
  .strict();

export async function createPedalboardFromRecipeTool(input: unknown, context: ToolContext) {
  const parsed = createPedalboardFromRecipeInputSchema.parse(input);
  if (!parsed.confirm) {
    return jsonContent({
      confirmed: false,
      imported: false,
      saved: false,
      loaded: false,
      notes: ["Tool input must include confirm=true."]
    });
  }

  const plan = await context.effectRecipeToPedalboardPlanService.convert(parsed.recipe);
  return jsonContent(
    await context.executePedalboardPlanService.execute({
      plan,
      confirm: true,
      title: parsed.title
    })
  );
}
