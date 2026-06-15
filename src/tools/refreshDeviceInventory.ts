import { emptyInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function refreshDeviceInventoryTool(input: unknown, context: ToolContext) {
  emptyInputSchema.parse(input);
  return jsonContent(await context.deviceInventoryService.refresh());
}
