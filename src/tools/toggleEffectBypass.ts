import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z
  .object({
    bundlepath: z.string().min(1).describe("Bundle path from list_pedalboards or inspect_pedalboard."),
    instance: z
      .string()
      .min(1)
      .describe("Instance name from inspect_pedalboard (e.g. 'reverb_3', '/graph/reverb_3')."),
    bypassed: z
      .boolean()
      .describe("true = bypass the effect (disable it), false = enable it."),
    persist: z
      .boolean()
      .default(false)
      .describe("Save bypass state to the bundle so it persists after reload. Defaults to false (live only)."),
    confirm: z.boolean()
  })
  .strict();

export async function toggleEffectBypassTool(input: unknown, context: ToolContext) {
  const parsed = schema.parse(input);
  const result = await context.graphEditorService.toggleEffectBypass(parsed);
  return jsonContent(result);
}
