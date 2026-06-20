import { jsonContent, type ToolContext } from "./toolContext.js";

export async function checkInventoryStatusTool(_input: unknown, context: ToolContext) {
  return jsonContent(await context.inventoryStatusService.getStatus());
}
