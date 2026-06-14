export interface PluginInfo {
  name?: string;
  uri?: string;
}

export interface PluginList {
  count: number;
  plugins: PluginInfo[];
}

export type PluginPortKind = "audio" | "control" | "atom" | "other";
export type PluginPortDirection = "input" | "output" | "unknown";

export interface PluginPort {
  index: number;
  symbol: string;
  name: string | null;
  types: string[];
  kind: PluginPortKind;
  direction: PluginPortDirection;
  default?: number;
  minimum?: number;
  maximum?: number;
  unit?: string;
  properties: string[];
}

export interface PluginPortInfo {
  uri: string;
  ports: PluginPort[];
  audioInputs: PluginPort[];
  audioOutputs: PluginPort[];
  controlInputs: PluginPort[];
}
