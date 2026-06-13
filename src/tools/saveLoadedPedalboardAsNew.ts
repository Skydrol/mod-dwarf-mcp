import { saveLoadedPedalboardAsNewInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function saveLoadedPedalboardAsNewTool(input: unknown, context: ToolContext) {
  const args = saveLoadedPedalboardAsNewInputSchema.parse(input);
  return jsonContent(await context.saveLoadedPedalboardService.saveAsNew(args));
}
