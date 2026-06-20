import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z
  .object({
    uri: z.string().min(1).describe("Exact LV2 plugin URI from list_plugins or search_plugins.")
  })
  .strict();

export async function getPluginParametersTool(input: unknown, context: ToolContext) {
  const { uri } = schema.parse(input);
  const ports = await context.pluginService.getPluginPorts(uri);
  return jsonContent({
    uri,
    controlInputs: ports.controlInputs.map((p) => ({
      symbol: p.symbol,
      label: p.name ?? p.symbol,
      minimum: p.minimum ?? null,
      maximum: p.maximum ?? null,
      default: p.default ?? null,
      unit: p.unit ?? null
    })),
    audioInputs: ports.audioInputs.map((p) => ({ symbol: p.symbol, label: p.name ?? p.symbol })),
    audioOutputs: ports.audioOutputs.map((p) => ({ symbol: p.symbol, label: p.name ?? p.symbol })),
    totalControlInputs: ports.controlInputs.length
  });
}
