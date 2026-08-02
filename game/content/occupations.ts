/**
 * Occupation definitions — the eight starting occupations for character creation.
 *
 * Rules:
 *   - All data is typed; no untyped blobs.
 *   - Attributes are deltas applied on top of the base spread (all 5s).
 *   - Every occupation has exactly one challenge flag (Tourist = true).
 *   - IDs follow the occupation.slug convention from ids.ts.
 *   - No React / browser dependencies.
 */

import { z } from "zod";
import { OccupationIdSchema } from "../schemas/ids";
import type { OccupationId } from "../schemas/ids";
import { AttributesSchema } from "../schemas/meters";
import type { Attributes } from "../schemas/meters";

// ── Occupation definition schema ──────────────────────────────────────────────

/** Signed delta applied to each attribute (clamped to [1,10] after application). */
export const AttributeDeltaSchema = z.object({
  strength: z.number().int().min(-4).max(4),
  endurance: z.number().int().min(-4).max(4),
  agility: z.number().int().min(-4).max(4),
  awareness: z.number().int().min(-4).max(4),
  intelligence: z.number().int().min(-4).max(4),
  technical: z.number().int().min(-4).max(4),
  medical: z.number().int().min(-4).max(4),
  survival: z.number().int().min(-4).max(4),
  social: z.number().int().min(-4).max(4),
  resolve: z.number().int().min(-4).max(4),
});

export type AttributeDelta = z.infer<typeof AttributeDeltaSchema>;

export const OccupationDefinitionSchema = z.object({
  id: OccupationIdSchema,
  /** Display name shown in the UI. */
  name: z.string().min(1).max(64),
  /** One-sentence summary shown in the selection list. */
  tagline: z.string().min(1).max(200),
  /** Two-to-four sentence description of strengths, tradeoffs, and playstyle. */
  description: z.string().min(1).max(1000),
  /** Attribute deltas applied on top of the all-5 base. */
  attributeDeltas: AttributeDeltaSchema,
  /**
   * When true, the occupation is presented as a deliberate challenge mode,
   * not as a joke. Tourist starts with the weakest attribute spread.
   */
  isChallenge: z.boolean(),
  /** Key strengths communicated to the player (2–4 items). */
  strengths: z.array(z.string().min(1).max(120)).min(2).max(4),
  /** Key tradeoffs communicated to the player (1–3 items). */
  tradeoffs: z.array(z.string().min(1).max(120)).min(1).max(3),
});

export type OccupationDefinition = z.infer<typeof OccupationDefinitionSchema>;

// ── Base attribute spread ─────────────────────────────────────────────────────

export const BASE_ATTRIBUTES: Attributes = {
  strength: 5,
  endurance: 5,
  agility: 5,
  awareness: 5,
  intelligence: 5,
  technical: 5,
  medical: 5,
  survival: 5,
  social: 5,
  resolve: 5,
};

/**
 * Apply an AttributeDelta to the base spread.
 * Results are clamped to the [1,10] attribute range.
 */
export function applyAttributeDeltas(delta: AttributeDelta): Attributes {
  const raw: Record<string, number> = {};
  for (const key of Object.keys(BASE_ATTRIBUTES) as (keyof Attributes)[]) {
    raw[key] = Math.min(10, Math.max(1, BASE_ATTRIBUTES[key] + delta[key]));
  }
  return AttributesSchema.parse(raw);
}

// ── Occupation data ───────────────────────────────────────────────────────────

const RAW_OCCUPATIONS = [
  {
    id: "occupation.mechanic",
    name: "Mechanic",
    tagline: "Keeps engines running when nothing else will.",
    description:
      "Years in the shop mean you can coax life out of broken vehicles, jury-rig fuel systems, and read a machine's symptoms before it dies. You're physically tough from the work and comfortable improvising with whatever parts you can scavenge. Your medical knowledge is limited and your social skills are blunt, but people trust competence.",
    attributeDeltas: {
      strength: 2,
      endurance: 2,
      agility: 0,
      awareness: 1,
      intelligence: 0,
      technical: 3,
      medical: -1,
      survival: 0,
      social: -1,
      resolve: 0,
    },
    isChallenge: false,
    strengths: [
      "Superior vehicle repair and improvisation",
      "High strength and endurance for physical work",
      "Reads mechanical failures early",
    ],
    tradeoffs: [
      "Weaker medical skill; injuries take longer to treat",
      "Direct communication style can create friction",
    ],
  },
  {
    id: "occupation.nurse-emt",
    name: "Nurse / EMT",
    tagline: "Keeps people alive when hospitals aren't an option.",
    description:
      "Your training covers trauma, infection, dosing, and improvised care under pressure. You can stretch limited supplies further than anyone else and spot illness before it becomes a crisis. You're calm under stress and genuinely good with frightened people — but you haven't spent much time outdoors or with engines, so you lean on others for those problems.",
    attributeDeltas: {
      strength: -1,
      endurance: 1,
      agility: 1,
      awareness: 2,
      intelligence: 2,
      technical: -1,
      medical: 4,
      survival: -1,
      social: 2,
      resolve: 1,
    },
    isChallenge: false,
    strengths: [
      "Strongest medical skill in the game",
      "Stretches medicine and supplies further",
      "Effective with companions and strangers alike",
    ],
    tradeoffs: [
      "Low survival skill; foraging and wilderness navigation are harder",
      "Limited technical ability for vehicle and gear repair",
    ],
  },
  {
    id: "occupation.farmer",
    name: "Farmer",
    tagline: "Knows how to make land work — and how to read it.",
    description:
      "Rural self-reliance runs deep: you can grow and preserve food, handle livestock, read weather, and fix equipment well enough to keep a farm running without outside help. You understand the land's rhythms and can find water and shelter where others see nothing. You're not built for city navigation or high-tech problems, but you rarely run out of options in open country.",
    attributeDeltas: {
      strength: 2,
      endurance: 3,
      agility: 0,
      awareness: 2,
      intelligence: 0,
      technical: 1,
      medical: 0,
      survival: 3,
      social: 0,
      resolve: 1,
    },
    isChallenge: false,
    strengths: [
      "Highest survival skill; foraging and route-reading excel",
      "Strong endurance for long travel",
      "Deeper connection to the farm destination",
    ],
    tradeoffs: [
      "Moderate technical skill; complex repairs take more time",
      "Less urban savvy; city checkpoints and negotiations are harder",
    ],
  },
  {
    id: "occupation.veteran",
    name: "Veteran",
    tagline: "Trained for adversity; experienced in its cost.",
    description:
      "Military service shaped how you read threat, move quietly, and stay functional when plans collapse. Your resolve is strong, your body is conditioned, and you understand small-unit tactics — but you've also seen enough to know what violence costs. Combat is a last resort, not a preference; your training includes de-escalation alongside force.",
    attributeDeltas: {
      strength: 2,
      endurance: 2,
      agility: 2,
      awareness: 2,
      intelligence: 0,
      technical: 1,
      medical: 1,
      survival: 2,
      social: -1,
      resolve: 3,
    },
    isChallenge: false,
    strengths: [
      "High resolve; stress and morale crises are more manageable",
      "Well-rounded physical attributes for demanding travel",
      "Tactical awareness of threats, terrain, and patrol patterns",
    ],
    tradeoffs: [
      "Moderate social penalty; some factions are wary of veterans",
      "No single exceptional skill; jack-of-many-trades",
    ],
  },
  {
    id: "occupation.electrician",
    name: "Electrician",
    tagline: "Makes power and communications work in a broken grid.",
    description:
      "You can read wiring diagrams, restore partial power from salvaged components, bypass lock systems, and get radios working — skills that open options no one else has. Your intelligence and technical depth let you understand new problems quickly. Physical work keeps you fit, but wilderness navigation and medicine are not your strengths.",
    attributeDeltas: {
      strength: 1,
      endurance: 1,
      agility: 0,
      awareness: 1,
      intelligence: 3,
      technical: 3,
      medical: -1,
      survival: -1,
      social: 0,
      resolve: 1,
    },
    isChallenge: false,
    strengths: [
      "Unlocks radio repair and power restoration options",
      "High technical and intelligence for problem-solving",
      "Can bypass certain security obstacles",
    ],
    tradeoffs: [
      "Low survival skill; wilderness travel is more costly",
      "Limited medical knowledge for injury and illness",
    ],
  },
  {
    id: "occupation.outdoors-guide",
    name: "Outdoors Guide",
    tagline: "At home in terrain that stops everyone else.",
    description:
      "Rivers, forests, swamps, and back-country routes are your domain. You can read weather, navigate without GPS, find clean water, move quietly, and keep a group fed off the land. Your agility and awareness make you hard to detect and easy to lose in terrain. Urban environments and medical emergencies are harder, and you prefer working outdoors where your skills shine.",
    attributeDeltas: {
      strength: 1,
      endurance: 3,
      agility: 3,
      awareness: 3,
      intelligence: 0,
      technical: -1,
      medical: -1,
      survival: 4,
      social: 1,
      resolve: 1,
    },
    isChallenge: false,
    strengths: [
      "Highest survival skill; unmatched wilderness navigation and foraging",
      "Exceptional agility and awareness for stealth and scouting",
      "River and water-route travel is significantly more efficient",
    ],
    tradeoffs: [
      "Lowest technical skill; vehicle and equipment repair are slow",
      "Limited medical ability; companions rely on you for survival, not treatment",
    ],
  },
  {
    id: "occupation.truck-driver",
    name: "Truck Driver",
    tagline: "Knows roads, routes, and how to keep moving.",
    description:
      "Years of long hauls gave you deep road knowledge, experience with vehicle mechanics, and the ability to stay alert and patient across exhausting distances. You're physically capable, good at reading situations on the road, and comfortable negotiating with strangers at fuel stops and checkpoints. Wilderness travel and high-skill medical work aren't your strengths.",
    attributeDeltas: {
      strength: 1,
      endurance: 3,
      agility: 0,
      awareness: 2,
      intelligence: 0,
      technical: 2,
      medical: -1,
      survival: 0,
      social: 2,
      resolve: 2,
    },
    isChallenge: false,
    strengths: [
      "Strong road and vehicle knowledge; faster travel on roads",
      "Good endurance for sustained travel",
      "Effective at checkpoint negotiations and trade",
    ],
    tradeoffs: [
      "Moderate survival skill; off-road and river routes are less efficient",
      "Limited medical knowledge",
    ],
  },
  {
    id: "occupation.tourist",
    name: "Tourist",
    tagline: "No relevant training. No field experience. Still here.",
    description:
      "You were in Pensacola for completely different reasons. You have no military background, no medical training, no survival skills, and no mechanical experience. What you have is determination and the ability to learn — every skill you develop is hard-won and meaningful. Tourist is a deliberate challenge mode: the journey is harder, the margins are thinner, and success feels earned.",
    attributeDeltas: {
      strength: -1,
      endurance: -1,
      agility: 0,
      awareness: 0,
      intelligence: 1,
      technical: -2,
      medical: -2,
      survival: -2,
      social: 1,
      resolve: 2,
    },
    isChallenge: true,
    strengths: [
      "High resolve; determination carries further than skill",
      "Better social instincts; people underestimate you",
    ],
    tradeoffs: [
      "Weakest technical, medical, and survival attributes",
      "Every specialised task takes longer and costs more",
      "Smallest margin for error across the run",
    ],
  },
] as const;

// Validate all definitions at module load time.
export const OCCUPATIONS: ReadonlyArray<OccupationDefinition> =
  RAW_OCCUPATIONS.map((raw) => OccupationDefinitionSchema.parse(raw));

/** Look up a single occupation by ID. Returns undefined if not found. */
export function getOccupation(
  id: OccupationId,
): OccupationDefinition | undefined {
  return OCCUPATIONS.find((o) => o.id === id);
}

/** All valid occupation IDs in definition order. */
export const OCCUPATION_IDS: ReadonlyArray<OccupationId> = OCCUPATIONS.map(
  (o) => o.id,
);
