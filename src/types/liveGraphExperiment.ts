import type { ApiCallRecord } from "./importBundle.js";

export interface LiveGraphExperimentWebsocketObservation {
  url: string;
  rawMessages: string[];
  addObserved: boolean;
  removeObserved: boolean;
  baselineInstances: Array<{ instance: string; uri: string }>;
  afterAddInstances: Array<{ instance: string; uri: string }>;
  afterRemoveInstances: Array<{ instance: string; uri: string }>;
}

export interface LiveGraphExperimentInspection {
  attempted: boolean;
  ok: boolean;
  status: number | null;
  pluginUris: string[];
  text: string;
  error?: string;
}

export interface LiveGraphExperimentResult {
  dryRun: false;
  confirm: true;
  plugin: {
    name: string;
    uri: string;
    instance: string;
    x: number;
    y: number;
  };
  websocket: LiveGraphExperimentWebsocketObservation;
  activeGraphInspection: {
    before: LiveGraphExperimentInspection;
    afterAdd: LiveGraphExperimentInspection;
    afterRemove: LiveGraphExperimentInspection;
  };
  apiCalls: ApiCallRecord[];
  success: boolean;
  unexpectedBehavior: string[];
  notes: string[];
}
