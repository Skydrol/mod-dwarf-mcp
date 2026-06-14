import { clearCurrentPedalboardInputSchema } from "../schemas/tools.js";
import type { ToolContext } from "./toolContext.js";
import { jsonContent } from "./toolContext.js";

export async function clearCurrentPedalboardTool(input: unknown, context: ToolContext) {
  const args = clearCurrentPedalboardInputSchema.parse(input);
  return jsonContent(await context.clearCurrentPedalboardService.clear(args));
}
