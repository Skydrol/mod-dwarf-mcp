export interface PluginInfo {
  name?: string;
  uri?: string;
}

export interface PluginList {
  count: number;
  plugins: PluginInfo[];
}
