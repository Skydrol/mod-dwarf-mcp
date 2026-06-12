import { bundlePathInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function listSnapshotsTool(input: unknown, context: ToolContext) {
  const args = bundlePathInputSchema.parse(input);
  return jsonContent(await context.snapshotService.listSnapshots(args.bundlePath));
}
