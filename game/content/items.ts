/**
 * Item definitions — the 25 starter items across core categories.
 *
 * Categories (from game-design.md):
 *   - water, food, medicine, ammunition, fuel, batteries, parts,
 *     clothes, maps/intelligence, tools, seed/feed, trade goods
 *
 * Each definition specifies weight (kg), volume (L), stackSize,
 * spoilageRate (condition loss per turn, 0 = non-perishable),
 * noiseContribution (0–10), and category.
 *
 * IDs follow item.<category>.<slug> convention.
 * Pure data — no React/browser dependencies.
 */

import { z } from "zod";
import { ItemIdSchema } from "../schemas/ids";
import type { ItemId } from "../schemas/ids";

// ── Item category ────────────────────────────────────────────────────────────

export const ItemCategorySchema = z.enum([
  "water",
  "food",
  "medicine",
  "ammunition",
  "fuel",
  "batteries",
  "parts",
  "clothes",
  "maps",
  "tools",
  "seed",
  "trade",
]);

export type ItemCategory = z.infer<typeof ItemCategorySchema>;

// ── Item definition schema ───────────────────────────────────────────────────

export const ItemDefinitionSchema = z.object({
  id: ItemIdSchema,
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(300),
  category: ItemCategorySchema,
  /** Weight per unit in kg. */
  weight: z.number().min(0),
  /** Volume per unit in liters. */
  volume: z.number().min(0),
  /** Maximum stack size. */
  stackSize: z.number().int().min(1).max(99),
  /** Condition loss per turn (0 = non-perishable). Deterministic spoilage. */
  spoilageRate: z.number().int().min(0).max(10),
  /** Noise contribution when carried (0–10). Affects stealth selectors. */
  noise: z.number().int().min(0).max(10),
  /** Whether this item can be consumed (food, water, medicine). */
  consumable: z.boolean(),
  /** Meter effects when consumed (only for consumable items). */
  consumeEffects: z
    .object({
      hunger: z.number().int().optional(),
      thirst: z.number().int().optional(),
      health: z.number().int().optional(),
      fatigue: z.number().int().optional(),
      stress: z.number().int().optional(),
      pain: z.number().int().optional(),
      infection: z.number().int().optional(),
    })
    .optional(),
});

export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;

// ── 25 starter items ─────────────────────────────────────────────────────────

const RAW_ITEMS = [
  // ─ Water (2) ─
  {
    id: "item.water.bottle-clean",
    name: "Clean Water Bottle",
    description: "A sealed bottle of potable water. Essential for survival.",
    category: "water",
    weight: 1.0,
    volume: 1.0,
    stackSize: 10,
    spoilageRate: 0,
    noise: 1,
    consumable: true,
    consumeEffects: { thirst: -30 },
  },
  {
    id: "item.water.bottle-contaminated",
    name: "Contaminated Water",
    description: "Murky water that needs purification before safe consumption.",
    category: "water",
    weight: 1.0,
    volume: 1.0,
    stackSize: 10,
    spoilageRate: 0,
    noise: 1,
    consumable: true,
    consumeEffects: { thirst: -25, infection: 15 },
  },
  // ─ Food (4) ─
  {
    id: "item.food.ration",
    name: "Trail Ration",
    description: "Compact high-calorie food. Keeps well.",
    category: "food",
    weight: 0.3,
    volume: 0.3,
    stackSize: 20,
    spoilageRate: 0,
    noise: 0,
    consumable: true,
    consumeEffects: { hunger: -25 },
  },
  {
    id: "item.food.canned-beans",
    name: "Canned Beans",
    description: "Sealed canned food. Heavy but shelf-stable.",
    category: "food",
    weight: 0.5,
    volume: 0.4,
    stackSize: 12,
    spoilageRate: 0,
    noise: 1,
    consumable: true,
    consumeEffects: { hunger: -30 },
  },
  {
    id: "item.food.fresh-fish",
    name: "Fresh Fish",
    description: "Caught fish. Nutritious but spoils quickly.",
    category: "food",
    weight: 0.8,
    volume: 0.6,
    stackSize: 5,
    spoilageRate: 5,
    noise: 0,
    consumable: true,
    consumeEffects: { hunger: -40 },
  },
  {
    id: "item.food.jerky",
    name: "Dried Jerky",
    description: "Preserved meat. Light and long-lasting.",
    category: "food",
    weight: 0.2,
    volume: 0.2,
    stackSize: 20,
    spoilageRate: 1,
    noise: 0,
    consumable: true,
    consumeEffects: { hunger: -20, thirst: 5 },
  },
  // ─ Medicine (3) ─
  {
    id: "item.medicine.bandage",
    name: "Bandage",
    description: "Basic wound dressing. Stops bleeding and prevents infection.",
    category: "medicine",
    weight: 0.1,
    volume: 0.1,
    stackSize: 20,
    spoilageRate: 0,
    noise: 0,
    consumable: true,
    consumeEffects: { health: 10, infection: -10 },
  },
  {
    id: "item.medicine.painkillers",
    name: "Painkillers",
    description: "Over-the-counter pain relief. Reduces pain and stress.",
    category: "medicine",
    weight: 0.05,
    volume: 0.05,
    stackSize: 30,
    spoilageRate: 0,
    noise: 0,
    consumable: true,
    consumeEffects: { pain: -20, stress: -10 },
  },
  {
    id: "item.medicine.antibiotics",
    name: "Antibiotics",
    description: "Prescription antibiotics. Treats active infections.",
    category: "medicine",
    weight: 0.05,
    volume: 0.05,
    stackSize: 10,
    spoilageRate: 0,
    noise: 0,
    consumable: true,
    consumeEffects: { infection: -30 },
  },
  // ─ Ammunition (2) ─
  {
    id: "item.ammunition.pistol-rounds",
    name: "Pistol Rounds",
    description: "Standard 9mm ammunition.",
    category: "ammunition",
    weight: 0.02,
    volume: 0.02,
    stackSize: 50,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  {
    id: "item.ammunition.shotgun-shells",
    name: "Shotgun Shells",
    description: "12-gauge shotgun shells.",
    category: "ammunition",
    weight: 0.04,
    volume: 0.04,
    stackSize: 25,
    spoilageRate: 0,
    noise: 1,
    consumable: false,
  },
  // ─ Fuel (1) ─
  {
    id: "item.fuel.gasoline-can",
    name: "Gasoline Can",
    description: "One gallon of gasoline for vehicles and generators.",
    category: "fuel",
    weight: 3.5,
    volume: 4.0,
    stackSize: 5,
    spoilageRate: 0,
    noise: 2,
    consumable: false,
  },
  // ─ Batteries (1) ─
  {
    id: "item.batteries.aa-pack",
    name: "AA Battery Pack",
    description: "Pack of four AA batteries for flashlights and radios.",
    category: "batteries",
    weight: 0.1,
    volume: 0.1,
    stackSize: 10,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  // ─ Parts (2) ─
  {
    id: "item.parts.duct-tape",
    name: "Duct Tape",
    description:
      "Universal repair material. Temporarily fixes almost anything.",
    category: "parts",
    weight: 0.3,
    volume: 0.3,
    stackSize: 5,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  {
    id: "item.parts.scrap-metal",
    name: "Scrap Metal",
    description: "Salvaged metal pieces for repairs and improvised tools.",
    category: "parts",
    weight: 2.0,
    volume: 1.0,
    stackSize: 10,
    spoilageRate: 0,
    noise: 3,
    consumable: false,
  },
  // ─ Clothes (2) ─
  {
    id: "item.clothes.rain-jacket",
    name: "Rain Jacket",
    description: "Waterproof jacket. Protects against rain and cold.",
    category: "clothes",
    weight: 0.5,
    volume: 1.5,
    stackSize: 1,
    spoilageRate: 0,
    noise: 1,
    consumable: false,
  },
  {
    id: "item.clothes.boots",
    name: "Hiking Boots",
    description: "Sturdy boots for rough terrain. Reduces foot injury risk.",
    category: "clothes",
    weight: 1.2,
    volume: 2.0,
    stackSize: 1,
    spoilageRate: 0,
    noise: 1,
    consumable: false,
  },
  // ─ Maps (1) ─
  {
    id: "item.maps.regional-map",
    name: "Regional Map",
    description: "Paper map covering the next chapter region. Aids navigation.",
    category: "maps",
    weight: 0.1,
    volume: 0.1,
    stackSize: 5,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  // ─ Tools (3) ─
  {
    id: "item.tools.knife",
    name: "Utility Knife",
    description:
      "Multi-purpose blade for cutting, preparing food, and self-defense.",
    category: "tools",
    weight: 0.3,
    volume: 0.2,
    stackSize: 1,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  {
    id: "item.tools.flashlight",
    name: "Flashlight",
    description: "Battery-powered light. Essential for night operations.",
    category: "tools",
    weight: 0.3,
    volume: 0.3,
    stackSize: 1,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  {
    id: "item.tools.water-filter",
    name: "Water Filter",
    description: "Portable filter for purifying contaminated water.",
    category: "tools",
    weight: 0.5,
    volume: 0.5,
    stackSize: 1,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  // ─ Seed (1) ─
  {
    id: "item.seed.vegetable-seeds",
    name: "Vegetable Seeds",
    description: "Mixed vegetable seeds. Valuable for the farm endgame.",
    category: "seed",
    weight: 0.2,
    volume: 0.2,
    stackSize: 10,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  // ─ Trade (3) ─
  {
    id: "item.trade.cigarettes",
    name: "Cigarettes",
    description: "Popular trade currency in crisis situations.",
    category: "trade",
    weight: 0.05,
    volume: 0.1,
    stackSize: 20,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
  {
    id: "item.trade.whiskey",
    name: "Whiskey Bottle",
    description:
      "High-value trade item. Also useful as disinfectant in emergencies.",
    category: "trade",
    weight: 1.0,
    volume: 0.8,
    stackSize: 5,
    spoilageRate: 0,
    noise: 2,
    consumable: true,
    consumeEffects: { stress: -15, pain: -10, fatigue: 10 },
  },
  {
    id: "item.trade.gold-ring",
    name: "Gold Ring",
    description: "Compact high-value trade item. Universally accepted.",
    category: "trade",
    weight: 0.02,
    volume: 0.01,
    stackSize: 10,
    spoilageRate: 0,
    noise: 0,
    consumable: false,
  },
] as const;

// Validate all definitions at module load time.
export const ITEMS: ReadonlyArray<ItemDefinition> = RAW_ITEMS.map((raw) =>
  ItemDefinitionSchema.parse(raw),
);

/** Look up a single item definition by ID. Returns undefined if not found. */
export function getItemDefinition(id: ItemId): ItemDefinition | undefined {
  return ITEMS.find((item) => item.id === id);
}

/** All valid item IDs in definition order. */
export const ITEM_IDS: ReadonlyArray<ItemId> = ITEMS.map((item) => item.id);
