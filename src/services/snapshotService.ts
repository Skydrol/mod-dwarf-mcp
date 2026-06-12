import type { CommandRunner } from "../clients/sshClient.js";
import type { SnapshotList } from "../types/snapshot.js";
import { normalizeSnapshots } from "./parsers.js";
import { readFile } from "./sshUtils.js";

export class SnapshotService {
  constructor(private readonly ssh: CommandRunner) {}

  async listSnapshots(bundlePath: string): Promise<SnapshotList> {
    const snapshotsPath = `${bundlePath}/snapshots.json`;
    const presetsPath = `${bundlePath}/presets.json`;
    const snapshotsText = await readFile(this.ssh, snapshotsPath);
    const presetsText = snapshotsText ? null : await readFile(this.ssh, presetsPath);

    if (!snapshotsText && !presetsText) {
      return { bundlePath, sourceFile: null, snapshots: [] };
    }

    const sourceFile = snapshotsText ? "snapshots.json" : "presets.json";
    const raw = JSON.parse(snapshotsText ?? presetsText ?? "[]") as unknown;
    const normalized = normalizeSnapshots(raw);
    return {
      bundlePath,
      sourceFile,
      current: normalized.current,
      snapshots: normalized.snapshots
    };
  }
}
