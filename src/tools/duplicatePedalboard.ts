import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z
  .object({
    sourceBundlePath: z
      .string()
      .min(1)
      .describe("Bundle path of the board to copy (from list_pedalboards)."),
    newTitle: z
      .string()
      .min(1)
      .describe("Title for the new duplicate board. Must be different from the original."),
    confirm: z.boolean()
  })
  .strict();

export async function duplicatePedalboardTool(input: unknown, context: ToolContext) {
  const parsed = schema.parse(input);
  const result = await context.graphEditorService.duplicateBoard(parsed);
  return jsonContent(result);
}
