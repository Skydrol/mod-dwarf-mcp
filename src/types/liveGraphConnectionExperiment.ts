import type { ApiCallRecord } from "./importBundle.js";

export interface LiveGraphConnectionExperimentPlugin {
  name: string;
  uri: string;
  instance: string;
  x: number;
  y: number;
}

export interface LiveGraphConnectionExperimentGraphState {
  nodes: Array<{ instance: string; uri: string }>;
  edges: Array<{ source: string; target: string }>;
}

export interface LiveGraphConnectionExperimentWebsocketState {
  url: string;
  rawMessages: string[];
  addObserved: boolean;
  connectObserved: boolean;
  disconnectObserved: boolean;
  removeObserved: boolean;
  baseline: LiveGraphConnectionExperimentGraphState;
  afterAdds: LiveGraphConnectionExperimentGraphState;
  afterConnects: LiveGraphConnectionExperimentGraphState;
  afterDisconnects: LiveGraphConnectionExperimentGraphState;
  afterRemoves: LiveGraphConnectionExperimentGraphState;
  final: LiveGraphConnectionExperimentGraphState;
  finalMatchesBaseline: boolean;
  expectedEdgesObserved: boolean;
}

export interface LiveGraphConnectionExperimentResult {
  dryRun: false;
  confirm: true;
  plugins: LiveGraphConnectionExperimentPlugin[];
  expectedConnections: Array<{ source: string; target: string }>;
  websocket: LiveGraphConnectionExperimentWebsocketState;
  apiCalls: ApiCallRecord[];
  success: boolean;
  unexpectedBehavior: string[];
  notes: string[];
}
