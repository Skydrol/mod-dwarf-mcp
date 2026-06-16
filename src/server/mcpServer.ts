import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CommandRunner } from "../clients/sshClient.js";
import type { HttpClient } from "../clients/httpClient.js";
import type { WriteHttpClient } from "../clients/writeHttpClient.js";
import { pluginCatalog } from "../data/pluginCatalog.js";
import { BankService } from "../services/bankService.js";
import { DeviceService } from "../services/deviceService.js";
import { DryBundleService } from "../services/dryBundleService.js";
import { ClearCurrentPedalboardService } from "../services/clearCurrentPedalboardService.js";
import { CreateNewPedalboardService } from "../services/createNewPedalboardService.js";
import { DeviceInventoryService } from "../services/deviceInventoryService.js";
import { ImportBundleService } from "../services/importBundleService.js";
import { LiveGraphBuilderService } from "../services/liveGraphBuilderService.js";
import { LiveGraphConnectionExperimentService } from "../services/liveGraphConnectionExperimentService.js";
import { LiveGraphAuthoringPlanService } from "../services/liveGraphAuthoringPlan.js";
import { LiveGraphExperimentService } from "../services/liveGraphExperimentService.js";
import { LoadExistingPedalboardService } from "../services/loadExistingPedalboardService.js";
import { PedalboardService } from "../services/pedalboardService.js";
import { PluginService } from "../services/pluginService.js";
import { PedalboardPlannerService } from "../services/pedalboardPlannerService.js";
import { SaveLoadedPedalboardService } from "../services/saveLoadedPedalboardService.js";
import { ExecutePedalboardPlanService } from "../services/executePedalboardPlanService.js";
import { SnapshotService } from "../services/snapshotService.js";
import { registerTools } from "./toolRegistry.js";
import type { ToolContext } from "../tools/toolContext.js";

export interface ServerDependencies {
  ssh: CommandRunner;
  http: HttpClient;
  writeHttp?: WriteHttpClient | null;
  writeToolsEnabled?: boolean;
  websocketUrl: string;
}

export function createMcpServer(deps: ServerDependencies): McpServer {
  const server = new McpServer({
    name: "mod-dwarf-mcp",
    version: "0.1.0"
  });

  const pluginService = new PluginService(null, pluginCatalog);
  const pedalboardService = new PedalboardService(deps.ssh);
  const context: ToolContext = {
    deviceService: new DeviceService(deps.ssh),
    pluginService,
    pedalboardService,
    bankService: new BankService(deps.ssh),
    snapshotService: new SnapshotService(deps.ssh),
    pedalboardPlannerService: new PedalboardPlannerService(pluginService),
    liveGraphAuthoringPlanService: new LiveGraphAuthoringPlanService(pluginService),
    liveGraphBuilderService: new LiveGraphBuilderService(
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true,
      deps.websocketUrl
    ),
    liveGraphExperimentService: new LiveGraphExperimentService(
      pluginService,
      deps.writeHttp ?? null,
      deps.websocketUrl
    ),
    liveGraphConnectionExperimentService: new LiveGraphConnectionExperimentService(
      pluginService,
      deps.writeHttp ?? null,
      deps.websocketUrl
    ),
    dryBundleService: new DryBundleService(pluginService),
    clearCurrentPedalboardService: new ClearCurrentPedalboardService(
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true
    ),
    createNewPedalboardService: new CreateNewPedalboardService(
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true
    ),
    deviceInventoryService: new DeviceInventoryService(deps.ssh),
    importBundleService: new ImportBundleService(
      pedalboardService,
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true
    ),
    saveLoadedPedalboardService: new SaveLoadedPedalboardService(
      pedalboardService,
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true
    ),
    loadExistingPedalboardService: new LoadExistingPedalboardService(
      pedalboardService,
      deps.writeHttp ?? null,
      deps.writeToolsEnabled === true
    ),
    executePedalboardPlanService: undefined as unknown as ExecutePedalboardPlanService
  };

  context.executePedalboardPlanService = new ExecutePedalboardPlanService(
    context.dryBundleService,
    context.importBundleService,
    context.saveLoadedPedalboardService,
    context.loadExistingPedalboardService,
  );

  void deps.http;
  registerTools(server, context);
  return server;
}

export async function runStdioServer(deps: ServerDependencies): Promise<void> {
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
