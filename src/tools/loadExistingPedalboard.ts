import { loadExistingPedalboardInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function loadExistingPedalboardTool(input: unknown, context: ToolContext) {
  const parsed = loadExistingPedalboardInputSchema.parse(input);
  return jsonContent(await context.loadExistingPedalboardService.load(parsed));
}
