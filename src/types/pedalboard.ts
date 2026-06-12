import type { SnapshotSummary } from "./snapshot.js";

export type PedalboardSource = "user" | "factory" | "unknown";

export interface PedalboardSummary {
  title: string | null;
  bundlePath: string;
  source: Exclude<PedalboardSource, "unknown">;
  hasManifest: boolean;
  hasSnapshots: boolean;
  hasPresets: boolean;
  hasAddressings: boolean;
}

export interface PedalboardList {
  user: PedalboardSummary[];
  factory: PedalboardSummary[];
}

export interface PedalboardInspection {
  bundlePath: string;
  title: string | null;
  source: PedalboardSource;
  files: {
    manifest: string | null;
    mainTtl: string | null;
    addressings: string | null;
    snapshots: string | null;
    presets: string | null;
    thumbnail: string | null;
    screenshot: string | null;
  };
  pluginsUsed: Array<{
    instance: string;
    uri: string;
  }>;
  connections: Array<{
    tail: string;
    head: string;
  }>;
  mappings: unknown;
  snapshots: SnapshotSummary[];
  metadata: {
    format: "lv2-bundle";
    ttlBased: true;
    jsonSidecars: string[];
  };
}
