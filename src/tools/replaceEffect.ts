import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const replaceEffectInputSchema = z
  .object({
    bundlepath: z.string().min(1),
    instanceToReplace: z.string().min(1),
    newPluginUri: z.string().min(1),
    newInstanceName: z.string().min(1).optional(),
    confirm: z.boolean()
  })
  .strict();

export async function replaceEffectTool(input: unknown, context: ToolContext) {
  const parsed = replaceEffectInputSchema.parse(input);
  return jsonContent(await context.graphEditorService.replaceEffect(parsed));
}
