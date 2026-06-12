import { listPedalboardsInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function listPedalboardsTool(input: unknown, context: ToolContext) {
  const args = listPedalboardsInputSchema.parse(input);
  return jsonContent(await context.pedalboardService.listPedalboards(args.source));
}
