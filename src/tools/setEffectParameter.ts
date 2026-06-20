import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const setEffectParameterInputSchema = z
  .object({
    bundlepath: z.string().min(1),
    instance: z.string().min(1),
    parameters: z
      .record(z.number())
      .describe("Map of LV2 symbol to numeric value, e.g. { \"Gain\": 0.5, \"Delay_S\": 0.3 }"),
    confirm: z.boolean()
  })
  .strict();

export async function setEffectParameterTool(input: unknown, context: ToolContext) {
  const parsed = setEffectParameterInputSchema.parse(input);
  return jsonContent(await context.graphEditorService.setEffectParameter(parsed));
}
