import type { PedalboardPlan } from "./plan.js";

export type LiveGraphApiMethod = "GET" | "POST";

export type LiveGraphApiBody =
  | { kind: "none" }
  | { kind: "json"; value?: unknown }
  | { kind: "form"; fields: Record<string, string | number | boolean> };

export interface LiveGraphApiCall {
  method: LiveGraphApiMethod;
  path: string;
  purpose: string;
  body: LiveGraphApiBody;
}

export interface LiveGraphPortRange {
  min: number;
  max: number;
  unit?: string;
}

export interface LiveGraphParameterPlan {
  requestedKey?: string;
  symbol: string;
  requestedRange?: unknown;
  resolvedRange?: unknown;
  value: number;
}

export interface LiveGraphPluginPlan {
  role: string;
  name: string;
  uri: string;
  instance: string;
  x: number;
  y: number;
  addCall: LiveGraphApiCall;
  parameterPlans: LiveGraphParameterPlan[];
  connectCalls: LiveGraphApiCall[];
}

export interface LiveGraphAuthoringValidation {
  valid: boolean;
  errors: string[];
  pluginUris: {
    valid: boolean;
    checked: string[];
    missing: string[];
  };
  ports: {
    valid: boolean;
    errors: string[];
  };
  connections: {
    valid: boolean;
    errors: string[];
    callCount: number;
  };
  parameters: {
    valid: boolean;
    errors: string[];
    callCount: number;
  };
  snapshotSave: {
    included: boolean;
    valid: boolean;
    note: string;
  };
  pedalboardSave: {
    valid: boolean;
    title: string;
  };
}

export interface LiveGraphAuthoringPlan {
  dryRun: true;
  sourcePlan: PedalboardPlan;
  title: string;
  validation: LiveGraphAuthoringValidation;
  plugins: LiveGraphPluginPlan[];
  apiCalls: LiveGraphApiCall[];
  notes: string[];
  unsupportedIdeas: string[];
}
