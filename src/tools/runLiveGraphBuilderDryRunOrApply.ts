import { runLiveGraphBuilderInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function runLiveGraphBuilderDryRunOrApplyTool(input: unknown, context: ToolContext) {
  const args = runLiveGraphBuilderInputSchema.parse(input);
  return jsonContent(await context.liveGraphBuilderService.run(args));
}
