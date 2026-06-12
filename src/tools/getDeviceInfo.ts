import { emptyInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function getDeviceInfoTool(input: unknown, context: ToolContext) {
  emptyInputSchema.parse(input);
  return jsonContent(await context.deviceService.getDeviceInfo());
}
