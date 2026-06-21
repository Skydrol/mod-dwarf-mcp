import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z.object({
  bundlepath: z.string().min(1),
  removedInstance: z.string().min(1),
  confirm: z.boolean()
}).strict();

export async function cleanupSnapshotReferencesTool(input: unknown, context: ToolContext) {
  const parsed = schema.parse(input);
  const result = await context.graphEditorService.cleanupSnapshotReferences(parsed);
  return jsonContent(result);
}
