import { jsonContent, type ToolContext } from "./toolContext.js";

export async function getCurrentBoardStateTool(_input: unknown, context: ToolContext) {
  const currentPath = await context.pedalboardService.getCurrentBoardPath();

  if (!currentPath) {
    return jsonContent({
      found: false,
      message:
        "No current-board tracking file found on the device. " +
        "Use list_pedalboards to see available boards and load_existing_pedalboard to load one.",
      currentBoardPath: null,
      inspection: null
    });
  }

  try {
    const inspection = await context.pedalboardService.inspectPedalboard(currentPath);
    return jsonContent({
      found: true,
      currentBoardPath: currentPath,
      title: inspection.title,
      source: inspection.source,
      pluginsUsed: inspection.pluginsUsed,
      connections: inspection.connections,
      snapshots: inspection.snapshots,
      files: inspection.files
    });
  } catch {
    return jsonContent({
      found: true,
      currentBoardPath: currentPath,
      title: null,
      message: "Found current board path but could not inspect bundle (it may have been moved or deleted).",
      inspection: null
    });
  }
}
