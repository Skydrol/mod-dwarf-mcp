import { z } from "zod";
import { jsonContent, type ToolContext } from "./toolContext.js";

const schema = z
  .object({
    query: z
      .string()
      .min(1)
      .describe(
        "Keyword to search in plugin name or URI. Case-insensitive. Examples: 'reverb', 'shimmer', 'chorus', 'delay', 'dragonfly'."
      ),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(30)
      .describe("Maximum results to return (default 30).")
  })
  .strict();

export async function searchPluginsTool(input: unknown, context: ToolContext) {
  const { query, limit } = schema.parse(input);
  const q = query.toLowerCase();
  const all = await context.pluginService.listPlugins("both");
  const matches = all.plugins
    .filter(
      (p) =>
        (p.name?.toLowerCase().includes(q) ?? false) ||
        (p.uri?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, limit);
  return jsonContent({
    query,
    totalInstalled: all.count,
    matchCount: matches.length,
    plugins: matches
  });
}
