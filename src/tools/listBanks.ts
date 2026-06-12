import { listBanksInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function listBanksTool(input: unknown, context: ToolContext) {
  const args = listBanksInputSchema.parse(input);
  return jsonContent(await context.bankService.listBanks(args.source));
}
