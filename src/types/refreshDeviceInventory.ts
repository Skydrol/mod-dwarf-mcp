export interface RefreshDeviceInventoryResult {
  pluginCount: number;
  newInventoryWritten: boolean;
  inventoryPath: string;
  knowledgeDbPath: string;
  knowledgeDbWritten: boolean;
}
