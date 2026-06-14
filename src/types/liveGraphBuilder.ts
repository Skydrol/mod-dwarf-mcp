import type { ApiCallRecord } from "./importBundle.js";
import type { LiveGraphConnectionExperimentGraphState } from "./liveGraphConnectionExperiment.js";
import type { LiveGraphApiCall, LiveGraphPluginPlan } from "./liveGraphAuthoringPlan.js";

export interface LiveGraphBuilderPlan {
  dryRun: true;
  title: string;
  plugins: LiveGraphPluginPlan[];
  apiCalls: LiveGraphApiCall[];
  notes: string[];
  unsupportedIdeas: string[];
  sourcePlan?: unknown;
  validation?: unknown;
}

export interface LiveGraphBuilderWebsocketState {
  url: string;
  rawMessages: string[];
  addObserved: boolean;
  connectObserved: boolean;
  disconnectObserved: boolean;
  removeObserved: boolean;
  baseline: LiveGraphConnectionExperimentGraphState;
  afterDisconnects: LiveGraphConnectionExperimentGraphState;
  afterAdds: LiveGraphConnectionExperimentGraphState;
  afterConnects: LiveGraphConnectionExperimentGraphState;
  afterParameters: LiveGraphConnectionExperimentGraphState;
  afterRollback: LiveGraphConnectionExperimentGraphState;
  final: LiveGraphConnectionExperimentGraphState;
  finalMatchesBaseline: boolean;
}

export interface LiveGraphBuilderResult {
  dryRun: boolean;
  mode: "dry_run" | "apply_temporary";
  confirmed: boolean;
  restoreAfterSeconds: number;
  supportedTopology: "linear_chain_v1";
  plan: LiveGraphBuilderPlan;
  websocket: LiveGraphBuilderWebsocketState;
  apiCalls: ApiCallRecord[];
  success: boolean;
  unexpectedBehavior: string[];
  notes: string[];
}
