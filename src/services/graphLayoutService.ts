import type { PlannedPlugin } from "../types/plan.js";

export type GraphLayoutLane = "utility" | "drive" | "modulation" | "time" | "output";

export interface GraphLayoutPlacement extends Pick<PlannedPlugin, "role" | "name" | "uri"> {
  x: number;
  y: number;
  lane: GraphLayoutLane;
}

const START_X = 120;
const STEP_X = 240;

const LANE_Y: Record<GraphLayoutLane, number> = {
  utility: 120,
  drive: 240,
  modulation: 360,
  time: 480,
  output: 600
};

export class GraphLayoutService {
  layoutPlugins(
    plugins: Array<Pick<PlannedPlugin, "role" | "name" | "uri">>
  ): GraphLayoutPlacement[] {
    return plugins.map((plugin, index) => {
      const lane = this.laneFor(plugin.role, plugin.name);
      return {
        role: plugin.role,
        name: plugin.name,
        uri: plugin.uri,
        lane,
        x: START_X + index * STEP_X,
        y: LANE_Y[lane]
      };
    });
  }

  private laneFor(role: string, name: string): GraphLayoutLane {
    const text = `${role} ${name}`.toLowerCase();

    if (text.includes("output")) return "output";
    if (
      text.includes("delay") ||
      text.includes("echo") ||
      text.includes("feedback") ||
      text.includes("reverb")
    ) {
      return "time";
    }
    if (
      text.includes("modulation") ||
      text.includes("chorus") ||
      text.includes("flanger") ||
      text.includes("phaser") ||
      text.includes("tremolo")
    ) {
      return "modulation";
    }
    if (
      text.includes("dynamics") ||
      text.includes("drive") ||
      text.includes("amp") ||
      text.includes("cabinet") ||
      text.includes("tone")
    ) {
      return "drive";
    }
    if (text.includes("gain") || text.includes("utility")) {
      return "utility";
    }
    return "drive";
  }
}
