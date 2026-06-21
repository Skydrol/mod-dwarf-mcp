import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z.object({ bundlepath: z.string().min(1) }).strict();

export async function validateAudioPathTool(input: unknown, context: ToolContext) {
  const parsed = schema.parse(input);
  const result = await context.graphEditorService.validateAudioPath(parsed.bundlepath);
  return jsonContent(result);
}
