import { createNewPedalboardInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function createNewPedalboardTool(input: unknown, context: ToolContext) {
  const args = createNewPedalboardInputSchema.parse(input);
  return jsonContent(await context.createNewPedalboardService.create(args));
}
