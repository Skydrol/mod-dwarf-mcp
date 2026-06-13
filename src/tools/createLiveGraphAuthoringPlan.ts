import { createLiveGraphAuthoringPlanInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function createLiveGraphAuthoringPlanTool(input: unknown, context: ToolContext) {
  const args = createLiveGraphAuthoringPlanInputSchema.parse(input);
  return jsonContent(await context.liveGraphAuthoringPlanService.buildPlan(args.plan));
}
