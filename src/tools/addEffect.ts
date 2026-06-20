import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const addEffectInputSchema = z
  .object({
    bundlepath: z.string().min(1),
    pluginUri: z.string().min(1),
    instanceName: z.string().min(1).optional(),
    position: z.enum(["first", "last"]).default("last"),
    confirm: z.boolean()
  })
  .strict();

export async function addEffectTool(input: unknown, context: ToolContext) {
  const parsed = addEffectInputSchema.parse(input);
  return jsonContent(await context.graphEditorService.addEffect(parsed));
}
