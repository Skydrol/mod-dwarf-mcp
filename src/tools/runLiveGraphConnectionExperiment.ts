import { liveGraphConnectionExperimentInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function runLiveGraphConnectionExperimentTool(input: unknown, context: ToolContext) {
  const args = liveGraphConnectionExperimentInputSchema.parse(input);
  return jsonContent(
    await context.liveGraphConnectionExperimentService.runTwoPluginConnectionExperiment(args)
  );
}
