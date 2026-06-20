import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z
  .object({
    bundlepath: z
      .string()
      .min(1)
      .describe("Bundle path from list_pedalboards (e.g. '/root/.pedalboards/My_Board.pedalboard')."),
    snapshotName: z
      .string()
      .min(1)
      .describe("Exact snapshot name from list_snapshots or inspect_pedalboard (e.g. 'Solo', 'Clean')."),
    confirm: z.boolean()
  })
  .strict();

export async function activateSnapshotTool(input: unknown, context: ToolContext) {
  const parsed = schema.parse(input);
  const result = await context.graphEditorService.activateSnapshot(parsed);
  return jsonContent(result);
}
