import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const removeEffectInputSchema = z
  .object({
    bundlepath: z.string().min(1),
    instance: z.string().min(1),
    reconnect: z.boolean().default(true),
    confirm: z.boolean()
  })
  .strict();

export async function removeEffectTool(input: unknown, context: ToolContext) {
  const parsed = removeEffectInputSchema.parse(input);
  return jsonContent(await context.graphEditorService.removeEffect(parsed));
}
