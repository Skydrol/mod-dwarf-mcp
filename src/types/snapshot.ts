export type SnapshotValue = number | string | boolean | null;

export interface SnapshotSummary {
  name: string;
  plugins: string[];
  portsByPlugin: Record<string, Record<string, SnapshotValue>>;
  parametersByPlugin: Record<string, Record<string, unknown>>;
}

export interface SnapshotList {
  bundlePath: string;
  sourceFile: "snapshots.json" | "presets.json" | null;
  current?: number;
  snapshots: SnapshotSummary[];
}
