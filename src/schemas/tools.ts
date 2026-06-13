import { z } from "zod";

export const emptyInputSchema = z.object({}).strict();

export const listPluginsInputSchema = z
  .object({
    format: z.enum(["names", "uris", "both"]).default("both")
  })
  .strict();

export const listPedalboardsInputSchema = z
  .object({
    source: z.enum(["user", "factory", "all"]).default("all")
  })
  .strict();

export const bundlePathInputSchema = z
  .object({
    bundlePath: z.string().min(1)
  })
  .strict();

export const listBanksInputSchema = z
  .object({
    source: z.enum(["user", "factory", "all"]).default("all")
  })
  .strict();

export type ListPluginsInput = z.infer<typeof listPluginsInputSchema>;
export type ListPedalboardsInput = z.infer<typeof listPedalboardsInputSchema>;
export type BundlePathInput = z.infer<typeof bundlePathInputSchema>;
export type ListBanksInput = z.infer<typeof listBanksInputSchema>;

export const planPedalboardInputSchema = z
  .object({
    style: z.string().min(1),
    instrument: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1),
    referenceArtists: z.array(z.string().min(1)).optional().default([])
  })
  .strict();

export type PlanPedalboardInput = z.infer<typeof planPedalboardInputSchema>;

const parameterRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.string().optional()
  })
  .strict();

const plannedPluginSchema = z
  .object({
    role: z.string().min(1),
    name: z.string().min(1),
    uri: z.string().min(1).optional(),
    reason: z.string().min(1),
    suggestedInstance: z.string().min(1),
    parameterRanges: z.record(parameterRangeSchema)
  })
  .strict();

const plannedSnapshotSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    parameterFocus: z.record(z.string())
  })
  .strict();

export const pedalboardPlanSchema = z
  .object({
    dryRun: z.literal(true),
    safety: z
      .object({
        writesFiles: z.literal(false),
        modifiesDevice: z.literal(false),
        callsPostEndpoints: z.literal(false)
      })
      .strict(),
    request: z
      .object({
        style: z.string().min(1),
        instrument: z.string().min(1),
        goals: z.array(z.string().min(1)).min(1),
        referenceArtists: z.array(z.string().min(1)).optional().default([])
      })
      .strict(),
    template: z
      .object({
        title: z.string().nullable(),
        bundlePath: z.string().min(1),
        source: z.enum(["user", "factory"]),
        reason: z.string().min(1)
      })
      .strict()
      .nullable(),
    availablePluginCount: z.number().int().nonnegative(),
    signalChain: z.array(plannedPluginSchema),
    snapshots: z.array(plannedSnapshotSchema),
    notes: z.array(z.string()),
    unsupportedIdeas: z.array(z.string())
  })
  .strict();

export const createPedalboardDryBundleInputSchema = z
  .object({
    plan: pedalboardPlanSchema
  })
  .strict();

export type CreatePedalboardDryBundleInput = z.infer<typeof createPedalboardDryBundleInputSchema>;

const dryBundleValidationSchema = z
  .object({
    pluginUris: z
      .object({ valid: z.boolean(), checked: z.array(z.string()), missing: z.array(z.string()) })
      .strict(),
    snapshots: z
      .object({
        valid: z.boolean(),
        errors: z.array(z.string()),
        snapshotCount: z.number().int().nonnegative()
      })
      .strict(),
    ttl: z
      .object({
        valid: z.boolean(),
        errors: z.array(z.string()),
        manifestReferencesMainTtl: z.boolean(),
        mainTtlHasPedalboardName: z.boolean(),
        pluginBlockCount: z.number().int().nonnegative(),
        connectionCount: z.number().int().nonnegative(),
        followsTemplateStructure: z.boolean()
      })
      .strict(),
    dryRun: z
      .object({
        localOnly: z.literal(true),
        uploadedToDevice: z.literal(false),
        calledModApi: z.literal(false),
        modifiedPedalboards: z.literal(false)
      })
      .strict()
  })
  .strict();

export const dryPedalboardBundleSchema = z
  .object({
    dryRun: z.literal(true),
    sourcePlan: pedalboardPlanSchema,
    directoryPath: z.string().min(1),
    bundlePath: z.string().min(1),
    generatedFiles: z
      .object({
        manifest: z.string().min(1),
        mainTtl: z.string().min(1),
        snapshots: z.string().min(1),
        addressings: z.string().min(1)
      })
      .strict(),
    validation: dryBundleValidationSchema
  })
  .strict();

export const importPedalboardDryBundleInputSchema = z
  .object({
    dryBundle: dryPedalboardBundleSchema,
    confirm: z.boolean(),
    targetName: z.string().min(1).optional()
  })
  .strict();

export type ImportPedalboardDryBundleInput = z.infer<typeof importPedalboardDryBundleInputSchema>;

export const saveLoadedPedalboardAsNewInputSchema = z
  .object({
    title: z.string().min(1),
    confirm: z.boolean()
  })
  .strict();

export type SaveLoadedPedalboardAsNewInput = z.infer<typeof saveLoadedPedalboardAsNewInputSchema>;

export const loadExistingPedalboardInputSchema = z
  .object({
    bundlePath: z.string().min(1),
    confirm: z.boolean()
  })
  .strict();

export type LoadExistingPedalboardInput = z.infer<typeof loadExistingPedalboardInputSchema>;
