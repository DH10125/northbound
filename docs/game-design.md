# Game design

## Vision

Northbound is an original narrative survival-management game. In 2026, a hostile fictional nation has used weaponized AI to compromise grids, water controls, satellites, transportation, communications, and industrial systems. The player is stranded in Pensacola and must reach their family farm near Butternut before drought, livestock loss, fire, occupation, or failing equipment makes the farm unsalvageable.

The player normally moves under darkness and uses daylight to conceal, sleep, heal, repair, craft, scout, trade, and build relationships. Success is not merely arrival: the final chapter tests whether the player can stabilize the farm and reconcile the needs they brought home.

## Experience pillars

1. **A long way home:** urgency comes from family and a deteriorating farm clock.
2. **Night is motion, day is vulnerability:** the phase rhythm drives every decision.
3. **Plans break:** disease, weather, people, damage, and misinformation force adaptation.
4. **People are resources and responsibilities:** companions remember choices and have boundaries.
5. **Violence costs:** stealth, negotiation, surrender, diversion, and retreat remain meaningful.
6. **Runs become stories:** seeded events create variety while flags and chains preserve coherence.

## Player promise

A run should take roughly 3–6 hours in v1.0, support save/resume, and produce a shareable journey summary. Difficulty presets alter transparency and pressure rather than merely inflating damage.

## Route and chapters

The map is a directed branching graph, not continuous GPS.

1. **Pensacola Escape (tutorial):** hotel, marina, neighborhoods, rail corridor, blocked interstates; panic, heat, fire, checkpoints, contaminated water, and first transport.
2. **Gulf Coast / Deep South:** rural roads, forest, swamps, farms, industrial corridors; water, insects, navigation, rumor quality, and route choice.
3. **Lower Mississippi:** canoes, jon boats, rafts, levees, patrols, debris, current, fuel, hull condition, and upstream travel.
4. **Middle Mississippi:** settlements, tolls, trade, piracy, factions, bridges, ports, islands, and moral compromise.
5. **Upper Mississippi:** cold, bluffs, locks, damaged dams, portage, scarcity, wildlife, and the need to leave the main river.
6. **Wisconsin Waterways:** Chippewa/Flambeau-inspired fictionalized connections, logging trails, rapids, forest roads, portage, isolation, and exhaustion.
7. **Butternut:** locate family, assess farm, resolve occupation/fire/well/livestock/seed crises, then choose whom the farm can sustain.

Geography should feel plausible without claiming a literally navigable real-world route.

## Core loop

Each turn is 2–6 in-world hours.

**Night:** travel, scout, forage, salvage, hunt/fish, approach or avoid settlements, change route, repair, wait, sneak, divert, ambush, or retreat.

**Day:** hide, sleep, treat, repair, cook, purify, gather, trade, talk, craft, study maps, improve concealment, stand guard, care for animals, or use radio.

Resolution updates distance, time, hunger, thirst, fatigue, temperature, stress, morale, cleanliness, pain, exposure, noise, visibility, wear, illness, relationships, pursuit, farm clock, and event eligibility.

## Character creation

The player chooses name, pronouns, age range, portrait/silhouette, occupation, motivation, and weakness. Occupations: Mechanic, Nurse/EMT, Farmer, Veteran, Electrician, Outdoors Guide, Truck Driver, and Tourist (challenge).

Attributes use 1–10: strength, endurance, agility, awareness, intelligence, technical, medical, survival, social, resolve. Derived stats include health, capacity, speed, accuracy, evasion, repair, resistance, morale recovery, stealth, and negotiation.

## Condition model

Meters: health, hunger, thirst, fatigue, temperature, stress, morale, infection, radiation, toxic exposure, cleanliness, pain, sleep debt. Long-term consequences can include mobility, grip, hearing, vision, lungs, nerves, scarring, trauma, grief, addiction/withdrawal, and malnutrition.

Illness is staged and symptom-led. Low medical skill sees symptoms and uncertainty, not a perfect diagnosis. Content families include dysentery, giardia, severe waterborne infection, leptospirosis, food poisoning, insect/tick illness, respiratory infection, smoke/chemical injury, wound infection, sepsis, tetanus, gangrene, fractures, internal injury, burns, heat/cold injury, dehydration, malnutrition, and radiation sickness. The game is not medical advice.

## Inventory and transport

Items have weight, volume, condition, value, noise, sensitivity, exposure vulnerability, and stack size. Storage exists on body, backpack, companion, vehicle/boat, cache, and settlement.

Resources include water by contamination state; food by calories/spoilage/preparation; medicine; ammunition; fuel; batteries; parts; clothes; maps/intelligence; tools; seed and feed; and trade goods.

Transport includes foot, bicycle, motorcycle, car/pickup/van, horse, canoe/kayak/jon boat/fishing boat/raft, and riverbank travel. Modes trade speed/capacity for noise, visibility, fuel, reliability, terrain, repair complexity, draft, stability, portage, and current. Failure can force abandonment.

## Stealth and threat

Detection depends on time, moon, weather, terrain, clothing, light/fire, noise, group size, animals, injury, companion behavior, surveillance, and pursuit. Hiding options range from buildings and culverts to forest camps, islands, safehouses, and camouflaged boats. Discovery can cause theft, ambush, detention, taxation, recruitment pressure, or transport loss.

## Encounters and combat

Encounters always frame intent, stakes, visible options, and uncertainty. Common options: observe, hide, talk, trade, deceive, intimidate, distract, surrender goods, flee, take cover, grapple, use melee/ranged weapons, aid a companion, or exploit terrain. Combat is turn-based and short. Wounds, noise, ammunition, reputation, trauma, and follow-up pursuit persist. Defeat may mean injury, capture, robbery, separation, or death; not every loss ends a run.

## Companions

Companions track skills, condition, morale, loyalty, fear, objectives, moral boundaries, hidden traits, and pairwise relationships. Examples: Marisol (marina mechanic), Reverend Cole (negotiator/pacifist), Eli (stealthy teen), Dr. Warren (older veterinarian), Tasha (combat-capable, suspicious), Noah (radio hobbyist). They may disagree, bond, leave, steal, sacrifice, demand detours, or challenge leadership.

## Factions

Use fictional local factions with comprehensible needs rather than simple good/evil alignment: emergency remnants, river cooperatives, toll settlements, farm defense leagues, raiders, religious shelters, smugglers, and machine-guided surveillance holdouts. Track reputation, debts, promises, disguises, territorial access, and faction-to-faction tension.

## Events

Events are filtered by chapter, node, terrain, weather, phase, condition, inventory, companions, reputation, flags, noise, pursuit, difficulty, cooldown, and seed. Types: environmental, medical, mechanical, social, moral, faction, combat, wildlife, salvage, navigation, story, companion, farm, and global update. Each has 2–6 choices, requirements/checks, weighted outcomes, effects, reactions, flags, and follow-up hooks.

## Environment

Heat, drought, wildfire/smoke, dam releases/floods, water storms, wind/lightning, cold rain/ice/fog/mud, falling trees/landslides, rapids/debris, industrial fire, chemical plume, radiation zone, algae/dead fish, crop fire, and insects affect travel and event pools.

## Progression and endings

Progression is mostly knowledge, relationships, equipment, scars, and route access—not power fantasy leveling. Farm state deteriorates on a visible but imperfect clock. Endings evaluate arrival time, family status, farm systems, livestock/seed, companions, faction consequences, health, knowledge, and final stabilization decisions. Outcomes range from thriving refuge to costly survival, evacuation, displacement, or failure.

## v1.0 content target

- 7 chapters, at least 45 route nodes and 70 edges
- 8 occupations, 6 recruitable companions, 8 faction archetypes
- 160 validated events, including 20 linked chains
- 80 items, 14 transport variants, 18 illness/injury definitions
- 8 farm finale scenarios and at least 12 ending summaries
- 3 difficulty presets plus content/accessibility settings

## Out of scope for v1.0

Multiplayer, accounts/cloud saves, live services, generative AI content, realistic ballistics, open-world movement, real-time combat, native apps, monetization, and a backend database.
