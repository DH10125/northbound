/**
 * Route and world location schemas.
 */

import { z } from "zod";
import { EdgeIdSchema, NodeIdSchema } from "./ids";

export const ChapterSchema = z.enum([
  "pensacola-escape",
  "gulf-coast",
  "lower-mississippi",
  "middle-mississippi",
  "upper-mississippi",
  "wisconsin-waterways",
  "butternut",
]);

export const TerrainSchema = z.enum([
  "urban",
  "suburban",
  "rural",
  "forest",
  "swamp",
  "river",
  "coast",
  "industrial",
  "farmland",
  "hills",
  "plains",
]);

export const PhaseSchema = z.enum(["day", "night", "dusk", "dawn"]);

export const WeatherSchema = z.enum([
  "clear",
  "cloudy",
  "rain",
  "heavy-rain",
  "storm",
  "fog",
  "snow",
  "ice",
  "smoke",
  "extreme-heat",
  "extreme-cold",
]);

export const RouteLocationSchema = z.object({
  currentNodeId: NodeIdSchema,
  /** Last edge traversed; null at start. */
  lastEdgeId: EdgeIdSchema.nullable(),
  chapter: ChapterSchema,
  terrain: TerrainSchema,
  /** Distance remaining to destination in arbitrary units. */
  distanceRemaining: z.number().min(0),
  /** Nodes already visited (for reachability checks). */
  visitedNodeIds: z.array(NodeIdSchema),
});

export type RouteLocation = z.infer<typeof RouteLocationSchema>;
