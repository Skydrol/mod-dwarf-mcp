import type { PedalboardPlan } from "./plan.js";

export interface DryBundleValidationReport {
  pluginUris: {
    valid: boolean;
    checked: string[];
    missing: string[];
  };
  snapshots: {
    valid: boolean;
    errors: string[];
    snapshotCount: number;
  };
  ttl: {
    valid: boolean;
    errors: string[];
    manifestReferencesMainTtl: boolean;
    mainTtlHasPedalboardName: boolean;
    pluginBlockCount: number;
    connectionCount: number;
    followsTemplateStructure: boolean;
  };
  dryRun: {
    localOnly: true;
    uploadedToDevice: false;
    calledModApi: false;
    modifiedPedalboards: false;
  };
}

export interface DryPedalboardBundle {
  dryRun: true;
  sourcePlan: PedalboardPlan;
  directoryPath: string;
  bundlePath: string;
  generatedFiles: {
    manifest: string;
    mainTtl: string;
    snapshots: string;
    addressings: string;
  };
  validation: DryBundleValidationReport;
}
