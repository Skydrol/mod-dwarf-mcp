import { executePedalboardPlanInputSchema } from "../schemas/tools.js";
import type { ToolContext } from "./toolContext.js";
import { jsonContent } from "./toolContext.js";

export async function executePedalboardPlanTool(input: unknown, context: ToolContext) {
  const parsed = executePedalboardPlanInputSchema.parse(input);
  return jsonContent(await context.executePedalboardPlanService.execute(parsed));
}
