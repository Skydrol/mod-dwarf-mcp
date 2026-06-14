import { runLiveGraphBuilderFromPromptInputSchema } from "../schemas/tools.js";
import { jsonContent, type ToolContext } from "./toolContext.js";

export async function runLiveGraphBuilderFromPromptTool(input: unknown, context: ToolContext) {
  const args = runLiveGraphBuilderFromPromptInputSchema.parse(input);
  const authoringPlan = await context.liveGraphAuthoringPlanService.buildPlan(args.plan);

  if (!authoringPlan.validation.valid) {
    return jsonContent({
      dryRun: args.mode === "dry_run",
      mode: args.mode,
      confirmed: args.confirm,
      restoreAfterSeconds: args.restoreAfterSeconds ?? 5,
      supportedTopology: "linear_chain_v1" as const,
      plan: authoringPlan,
      websocket: {
        url: "",
        rawMessages: [],
        addObserved: false,
        connectObserved: false,
        disconnectObserved: false,
        removeObserved: false,
        baseline: { nodes: [], edges: [] },
        afterDisconnects: { nodes: [], edges: [] },
        afterAdds: { nodes: [], edges: [] },
        afterConnects: { nodes: [], edges: [] },
        afterParameters: { nodes: [], edges: [] },
        afterRollback: { nodes: [], edges: [] },
        final: { nodes: [], edges: [] },
        finalMatchesBaseline: false
      },
      apiCalls: [],
      success: false,
      unexpectedBehavior: authoringPlan.validation.errors.length
        ? authoringPlan.validation.errors
        : ["Prompt-derived plan validation failed."],
      notes: authoringPlan.notes
    });
  }

  return jsonContent(
    await context.liveGraphBuilderService.run({
      mode: args.mode,
      confirm: args.confirm,
      restoreAfterSeconds: args.restoreAfterSeconds,
      plan: authoringPlan
    })
  );
}
