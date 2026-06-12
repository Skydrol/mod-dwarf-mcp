import { bundlePathInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function inspectPedalboardTool(input: unknown, context: ToolContext) {
  const args = bundlePathInputSchema.parse(input);
  return jsonContent(await context.pedalboardService.inspectPedalboard(args.bundlePath));
}
