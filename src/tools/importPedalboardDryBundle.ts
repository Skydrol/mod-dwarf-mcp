import { importPedalboardDryBundleInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function importPedalboardDryBundleTool(input: unknown, context: ToolContext) {
  const args = importPedalboardDryBundleInputSchema.parse(input);
  return jsonContent(await context.importBundleService.importDryBundle(args));
}
