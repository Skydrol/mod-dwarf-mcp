import { planPedalboardInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function planPedalboardFromPromptTool(input: unknown, context: ToolContext) {
  const args = planPedalboardInputSchema.parse(input);
  return jsonContent(await context.pedalboardPlannerService.planFromPrompt(args));
}
