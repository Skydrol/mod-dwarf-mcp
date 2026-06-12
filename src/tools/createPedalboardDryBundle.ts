import { createPedalboardDryBundleInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function createPedalboardDryBundleTool(input: unknown, context: ToolContext) {
  const args = createPedalboardDryBundleInputSchema.parse(input);
  return jsonContent(await context.dryBundleService.createDryBundle(args.plan));
}
