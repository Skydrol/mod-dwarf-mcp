import { z } from "zod";
import { effectRecipeSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

const modifyCurrentBoardInputSchema = z
  .object({
    bundlepath: z.string().min(1),
    recipe: effectRecipeSchema,
    confirm: z.boolean(),
    title: z.string().min(1).optional()
  })
  .strict();

export async function modifyCurrentBoardTool(input: unknown, context: ToolContext) {
  const parsed = modifyCurrentBoardInputSchema.parse(input);
  if (!parsed.confirm) {
    return jsonContent({
      confirmed: false,
      saved: false,
      notes: ["Tool input must include confirm=true."]
    });
  }

  const recipe = { ...parsed.recipe, operationMode: "modify_current_board" as const };
  const plan = await context.effectRecipeToPedalboardPlanService.convert(recipe);

  return jsonContent(
    await context.executePedalboardPlanService.execute({
      plan,
      confirm: true,
      title: parsed.title,
      targetBundlepath: parsed.bundlepath
    })
  );
}
