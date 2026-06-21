import { jsonContent, type ToolContext } from "./toolContext.js";

export async function checkBypassSupportTool(_input: unknown, context: ToolContext) {
  const result = await context.graphEditorService.checkBypassSupport();
  return jsonContent(result);
}
