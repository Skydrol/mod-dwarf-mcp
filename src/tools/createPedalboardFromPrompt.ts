import { executePedalboardPlanInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function createPedalboardFromPromptTool(input: unknown, context: ToolContext) {
  const args = executePedalboardPlanInputSchema.parse(input);
  return jsonContent(await context.executePedalboardPlanService.execute(args));
}
