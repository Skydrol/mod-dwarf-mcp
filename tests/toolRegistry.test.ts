import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

function toolNameFromFile(fileName: string): string | null {
  const fileBase = basename(fileName, ".ts");
  const aliases: Record<string, string> = {
    validateAudioPath: "validate_current_board_audio_path"
  };

  if (aliases[fileBase]) {
    return aliases[fileBase];
  }

  const source = readFileSync(join("src/tools", fileName), "utf8");
  const exportMatch = source.match(/export\s+async\s+function\s+([A-Za-z0-9_]+Tool)\b/);
  if (!exportMatch) {
    return null;
  }

  return exportMatch[1]
    .replace(/Tool$/, "")
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_/, "");
}

describe("tool registry coverage", () => {
  it("registers every tool module exactly once", () => {
    const toolFiles = readdirSync("src/tools")
      .filter((file) => file.endsWith(".ts") && file !== "toolContext.ts")
      .sort();
    const expectedToolNames = toolFiles
      .map((file) => toolNameFromFile(file))
      .filter((name): name is string => name !== null)
      .sort();
    const registrySource = readFileSync("src/server/toolRegistry.ts", "utf8");
    const registeredNames = [...registrySource.matchAll(/registerTool\(\s*"([^"]+)"/g)]
      .map((match) => match[1])
      .sort();

    expect(new Set(registeredNames).size).toBe(registeredNames.length);
    expect(registeredNames).toEqual(expectedToolNames);
  });
});
