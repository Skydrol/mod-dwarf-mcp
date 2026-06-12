import { listPluginsInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function listPluginsTool(input: unknown, context: ToolContext) {
  const args = listPluginsInputSchema.parse(input);
  return jsonContent(await context.pluginService.listPlugins(args.format));
}
