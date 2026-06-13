import { liveGraphExperimentInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function runLiveGraphExperimentTool(input: unknown, context: ToolContext) {
  const args = liveGraphExperimentInputSchema.parse(input);
  return jsonContent(await context.liveGraphExperimentService.runTinyGainMonoExperiment(args));
}
