/**
 * Pensacola tutorial event definitions — 24 authored events covering:
 *
 *   - Opening/tutorial events (contextual, skippable)
 *   - First family signal
 *   - Supply and transport choices
 *   - Stealth teaching
 *   - Three viable exit routes
 *   - Failure and recovery states
 *
 * All events are data-only, validated by EventDefinitionSchema.
 * Pure data — no React/browser dependencies.
 */

import type { EventDefinition } from "./event-definitions";

// ── Opening / tutorial events ──────────────────────────────────────────────────

const tutorialWakeUp: EventDefinition = {
  id: "event.pensacola.tutorial-wake-up",
  version: 1,
  title: "Waking in Darkness",
  text: "You jolt awake in a pitch-black hotel room. The air conditioning is silent. Through the window, Pensacola's skyline is dark — no streetlights, no neon, nothing. Your phone is dead. From the hallway, muffled voices and the sound of slamming doors.",
  tags: ["tutorial", "opening", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "not-has", value: "tutorial-started" },
    ],
  },
  weight: 100,
  once: true,
  options: [
    {
      id: "opt-gather",
      label: "Gather your things and check the hallway",
      outcomes: [
        {
          weight: 1,
          text: "You fumble through your luggage by touch. The hallway is chaos — guests in pajamas, a child crying, someone shouting about the power grid. Whatever happened, it was sudden and total.",
          effects: [
            { type: "flag-set", flag: "tutorial-started" },
            { type: "flag-set", flag: "tutorial-tip-available" },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
    {
      id: "opt-window",
      label: "Look out the window first",
      outcomes: [
        {
          weight: 1,
          text: "The Gulf reflects moonlight, but the city is utterly dark. No headlights move on the streets below. A distant orange glow — fire? — flickers near the interstate. This is not a normal power outage.",
          effects: [
            { type: "flag-set", flag: "tutorial-started" },
            { type: "flag-set", flag: "tutorial-tip-available" },
            { type: "flag-set", flag: "saw-fire-glow" },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
  ],
};

const tutorialTipMovement: EventDefinition = {
  id: "event.pensacola.tutorial-tip-movement",
  version: 1,
  title: "Getting Your Bearings",
  text: "The hotel lobby is emptying fast. A hand-cranked emergency radio behind the desk crackles: '...all citizens are advised to shelter in place. Do not attempt to travel on major highways...' The front doors are propped open. Fresh air carries the smell of smoke.",
  tags: ["tutorial", "teaching", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-tip-available" },
      { field: "flag", op: "not-has", value: "tutorial-movement-done" },
    ],
  },
  weight: 80,
  once: true,
  options: [
    {
      id: "opt-listen",
      label: "Listen carefully to the radio",
      outcomes: [
        {
          weight: 1,
          text: "The broadcast is fragmented but clear enough: infrastructure failures across the Southeast, National Guard mobilizing, all non-essential travel prohibited. You need to move — but carefully. Choosing your route matters. Every path has tradeoffs between speed, safety, and stealth.",
          effects: [
            { type: "flag-set", flag: "tutorial-movement-done" },
            { type: "flag-set", flag: "heard-radio-broadcast" },
          ],
        },
      ],
    },
    {
      id: "opt-skip-tutorial",
      label: "I already know what I need to do",
      outcomes: [
        {
          weight: 1,
          text: "You step past the lobby and into the night. The streets are yours to navigate.",
          effects: [
            { type: "flag-set", flag: "tutorial-movement-done" },
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "tutorial-supplies-done" },
            { type: "flag-set", flag: "tutorial-skipped" },
          ],
        },
      ],
    },
  ],
};

const tutorialTipSupplies: EventDefinition = {
  id: "event.pensacola.tutorial-tip-supplies",
  version: 1,
  title: "Packing Smart",
  text: "In the hotel's utility closet, you find a few useful items scattered among cleaning supplies. A maintenance worker's abandoned lunch bag sits on a shelf. You can only carry so much — weight slows you down and noise draws attention.",
  tags: ["tutorial", "teaching", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-movement-done" },
      { field: "flag", op: "not-has", value: "tutorial-supplies-done" },
    ],
  },
  weight: 80,
  once: true,
  options: [
    {
      id: "opt-take-carefully",
      label: "Take only essentials — stay light and quiet",
      outcomes: [
        {
          weight: 1,
          text: "You select a water bottle and a few food items, leaving the heavier gear behind. Less weight means faster movement and less noise. In a crisis, sometimes what you leave behind matters as much as what you carry.",
          effects: [
            { type: "flag-set", flag: "tutorial-supplies-done" },
            { type: "flag-set", flag: "packed-light" },
            {
              type: "inventory-add",
              itemId: "item.water.bottle-clean",
              quantity: 2,
            },
            { type: "inventory-add", itemId: "item.food.ration", quantity: 2 },
          ],
        },
      ],
    },
    {
      id: "opt-take-everything",
      label: "Load up — take everything useful",
      outcomes: [
        {
          weight: 1,
          text: "You stuff your bag full. It is heavy and the metal items clink together with each step. More supplies give you more options, but the weight and noise may become a problem.",
          effects: [
            { type: "flag-set", flag: "tutorial-supplies-done" },
            { type: "flag-set", flag: "packed-heavy" },
            { type: "meter", meter: "fatigue", delta: 10 },
            {
              type: "inventory-add",
              itemId: "item.water.bottle-clean",
              quantity: 3,
            },
            { type: "inventory-add", itemId: "item.food.ration", quantity: 4 },
            {
              type: "inventory-add",
              itemId: "item.food.canned-beans",
              quantity: 2,
            },
            {
              type: "inventory-add",
              itemId: "item.medicine.bandage",
              quantity: 2,
            },
            {
              type: "inventory-add",
              itemId: "item.tools.flashlight",
              quantity: 1,
            },
          ],
        },
      ],
    },
  ],
};

const tutorialTipStealth: EventDefinition = {
  id: "event.pensacola.tutorial-tip-stealth",
  version: 1,
  title: "Staying Unseen",
  text: "Flashlight beams sweep the street from a slow-moving vehicle — some kind of patrol. You press against a wall and hold your breath. The beams pass by without stopping. In this new world, being seen by the wrong people can be dangerous. Your noise level and the time of day affect how easily you are detected.",
  tags: ["tutorial", "teaching", "stealth", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-supplies-done" },
      { field: "flag", op: "not-has", value: "tutorial-stealth-done" },
    ],
  },
  weight: 80,
  once: true,
  options: [
    {
      id: "opt-wait-dark",
      label: "Wait for the patrol to pass, then move in darkness",
      outcomes: [
        {
          weight: 1,
          text: "Patience pays off. The patrol rounds the corner and you slip across the street unseen. Traveling at night is riskier for navigation but much harder for others to spot you. Keep your carried noise low by choosing items carefully.",
          effects: [
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "stealth-learned" },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
    {
      id: "opt-bluff-through",
      label: "Walk confidently — act like you belong",
      check: { attribute: "social", difficulty: 12, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You stroll past the patrol with purpose. They do not stop you. Social skills can sometimes substitute for stealth — but not always.",
          effects: [
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "stealth-learned" },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "You wave casually and one of the patrol members waves back, disinterested. Confidence is its own camouflage.",
          effects: [
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "stealth-learned" },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "They slow down and shine a light your way. You duck into an alley before they can get a good look. That was close. Not every situation can be talked through.",
          effects: [
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "stealth-learned" },
            { type: "meter", meter: "stress", delta: 10 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "They yell at you to stop. You bolt into a side street and lose them after several terrifying minutes. Your heart pounds in your ears. Stealth through force of personality has its limits.",
          effects: [
            { type: "flag-set", flag: "tutorial-stealth-done" },
            { type: "flag-set", flag: "stealth-learned" },
            { type: "meter", meter: "stress", delta: 20 },
            { type: "meter", meter: "fatigue", delta: 15 },
          ],
        },
      ],
    },
  ],
};

// ── Family signal ────────────────────────────────────────────────────────────

const familySignal: EventDefinition = {
  id: "event.pensacola.family-signal",
  version: 1,
  title: "A Familiar Voice",
  text: "You find a working battery radio in an abandoned car. Scanning through static, you catch a fragment of a message: '...to all family members heading north: the farm is intact. We are holding on but supplies are limited. We will wait as long as we can. If you are hearing this, keep moving north. Follow the river when you can...' The voice is unmistakable — family.",
  tags: ["story", "family", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "family-signal-received" },
    ],
  },
  weight: 90,
  once: true,
  options: [
    {
      id: "opt-memorize",
      label: "Memorize the frequency and keep the radio",
      outcomes: [
        {
          weight: 1,
          text: "You note the frequency and tuck the radio into your pack. It is heavy, but it is also your lifeline — proof that someone is waiting for you. The farm is real. The journey is worth it.",
          effects: [
            { type: "flag-set", flag: "family-signal-received" },
            { type: "flag-set", flag: "has-radio" },
            { type: "meter", meter: "morale", delta: 15 },
            { type: "meter", meter: "stress", delta: -10 },
          ],
        },
      ],
    },
    {
      id: "opt-listen-more",
      label: "Stay and listen for more details",
      outcomes: [
        {
          weight: 1,
          text: "The broadcast repeats twice more, adding details: the bridge north is still passable, but checkpoint activity is increasing. They mention a bayou trail as a backup route. Then the signal fades to static.",
          effects: [
            { type: "flag-set", flag: "family-signal-received" },
            { type: "flag-set", flag: "family-signal-detailed" },
            { type: "meter", meter: "morale", delta: 20 },
            { type: "meter", meter: "stress", delta: -15 },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
  ],
};

// ── Supply and transport choice events ───────────────────────────────────────

const abandonedBicycle: EventDefinition = {
  id: "event.pensacola.abandoned-bicycle",
  version: 1,
  title: "An Unlocked Bicycle",
  text: "Leaning against a porch railing, a mountain bike with two flat-free tires. The chain is rusty but functional. Bicycles are faster than walking and quieter than vehicles, but they limit what you can carry.",
  tags: ["transport", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-started" },
      { field: "flag", op: "not-has", value: "found-bicycle" },
      { field: "flag", op: "not-has", value: "found-vehicle" },
    ],
  },
  weight: 30,
  once: true,
  options: [
    {
      id: "opt-take-bike",
      label: "Take the bicycle",
      outcomes: [
        {
          weight: 1,
          text: "You swing a leg over and test the pedals. The chain squeaks but holds. You can move faster now, though some rougher paths may require dismounting.",
          effects: [
            { type: "flag-set", flag: "found-bicycle" },
            { type: "flag-set", flag: "has-transport" },
            { type: "meter", meter: "morale", delta: 5 },
            {
              type: "transport-set",
              mode: "bicycle",
              instanceId: "transport.pensacola.bicycle",
              definitionId: "transport.bicycle",
              condition: 70,
            },
          ],
        },
      ],
    },
    {
      id: "opt-leave-bike",
      label: "Leave it — stay on foot for maximum flexibility",
      outcomes: [
        {
          weight: 1,
          text: "Bikes are noisy in the quiet and limit your route options through narrow spaces. You continue on foot.",
          effects: [{ type: "flag-set", flag: "found-bicycle" }],
        },
      ],
    },
  ],
};

const scavengeOpportunity: EventDefinition = {
  id: "event.pensacola.scavenge-pharmacy",
  version: 1,
  title: "Ransacked Pharmacy",
  text: "A pharmacy with its front window shattered. Most shelves are stripped bare, but the back room door is jammed shut. You might be able to force it open — but the noise could attract attention.",
  tags: ["supply", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-started" },
      { field: "flag", op: "not-has", value: "pharmacy-visited" },
    ],
  },
  weight: 25,
  once: true,
  options: [
    {
      id: "opt-force-door",
      label: "Force the back room door",
      check: { attribute: "strength", difficulty: 10, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "The door gives way with a crack. Inside: sealed bandages, a bottle of painkillers, and some clean water. A worthwhile haul.",
          effects: [
            { type: "flag-set", flag: "pharmacy-visited" },
            { type: "flag-set", flag: "pharmacy-success" },
            {
              type: "inventory-add",
              itemId: "item.medicine.bandage",
              quantity: 2,
            },
            {
              type: "inventory-add",
              itemId: "item.medicine.painkillers",
              quantity: 3,
            },
            {
              type: "inventory-add",
              itemId: "item.water.bottle-clean",
              quantity: 1,
            },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "The door pops open cleanly. The back room is nearly untouched — antibiotics, bandages, painkillers. You fill your bag with medical supplies.",
          effects: [
            { type: "flag-set", flag: "pharmacy-visited" },
            { type: "flag-set", flag: "pharmacy-jackpot" },
            { type: "meter", meter: "morale", delta: 5 },
            {
              type: "inventory-add",
              itemId: "item.medicine.antibiotics",
              quantity: 2,
            },
            {
              type: "inventory-add",
              itemId: "item.medicine.bandage",
              quantity: 4,
            },
            {
              type: "inventory-add",
              itemId: "item.medicine.painkillers",
              quantity: 5,
            },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "The door budges but does not open. The noise echoes through the empty store. You hear footsteps outside and decide to leave empty-handed.",
          effects: [
            { type: "flag-set", flag: "pharmacy-visited" },
            { type: "meter", meter: "stress", delta: 10 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "The door frame splinters loudly. Voices shout from outside. You scramble out the back and run. Nothing gained and your stress is elevated.",
          effects: [
            { type: "flag-set", flag: "pharmacy-visited" },
            { type: "meter", meter: "stress", delta: 20 },
            { type: "meter", meter: "fatigue", delta: 10 },
          ],
        },
      ],
    },
    {
      id: "opt-skip-pharmacy",
      label: "Too risky — keep moving",
      outcomes: [
        {
          weight: 1,
          text: "You pass the pharmacy without stopping. Discretion over desperation.",
          effects: [{ type: "flag-set", flag: "pharmacy-visited" }],
        },
      ],
    },
  ],
};

const waterSource: EventDefinition = {
  id: "event.pensacola.water-source",
  version: 1,
  title: "A Working Spigot",
  text: "Behind a shuttered restaurant, a garden hose still has pressure — probably gravity-fed from a rooftop tank. The water looks clear but you cannot be certain it is safe.",
  tags: ["supply", "water", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-started" },
      { field: "flag", op: "not-has", value: "found-water-source" },
      { field: "meter.thirst", op: "gte", value: 15 },
    ],
  },
  weight: 35,
  once: true,
  options: [
    {
      id: "opt-drink-directly",
      label: "Drink from the hose — risk it",
      outcomes: [
        {
          weight: 3,
          text: "The water tastes metallic but your body drinks gratefully. You fill every container you can. It seems safe enough.",
          effects: [
            { type: "flag-set", flag: "found-water-source" },
            { type: "meter", meter: "thirst", delta: -30 },
          ],
        },
        {
          weight: 1,
          text: "You drink deeply, but within an hour your stomach cramps. The water was not as clean as it looked.",
          effects: [
            { type: "flag-set", flag: "found-water-source" },
            { type: "meter", meter: "thirst", delta: -25 },
            { type: "meter", meter: "health", delta: -5 },
            { type: "meter", meter: "infection", delta: 10 },
          ],
        },
      ],
    },
    {
      id: "opt-pass-water",
      label: "Cannot risk contamination — move on",
      outcomes: [
        {
          weight: 1,
          text: "You leave the water behind. A cautious choice, but your thirst remains.",
          effects: [{ type: "flag-set", flag: "found-water-source" }],
        },
      ],
    },
  ],
};

// ── Route / exit events ──────────────────────────────────────────────────────

const routeChoiceHighway: EventDefinition = {
  id: "event.pensacola.route-highway",
  version: 1,
  title: "The Highway Option",
  text: "From an overpass, you can see the interstate stretching north. It is the most direct route to the bridge, but a military checkpoint is visible ahead. Long lines of vehicles idle in the dark. Some are being turned back. Others are not.",
  tags: ["route", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "route-highway-seen" },
      { field: "visitedNode", op: "has", value: "node.pensacola.gas-station" },
    ],
  },
  weight: 40,
  once: true,
  options: [
    {
      id: "opt-try-checkpoint",
      label: "Risk the checkpoint — speed matters",
      check: { attribute: "social", difficulty: 14, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You blend in with a group of refugees and pass through. The soldiers look exhausted, processing people mechanically. You are through.",
          effects: [
            { type: "flag-set", flag: "route-highway-seen" },
            { type: "flag-set", flag: "checkpoint-passed" },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "A sympathetic guard waves you through a priority lane. Sometimes looking desperate enough is its own kind of credential.",
          effects: [
            { type: "flag-set", flag: "route-highway-seen" },
            { type: "flag-set", flag: "checkpoint-passed" },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "They ask for identification you do not have. You are turned away and told to return to the shelter zone. You slip away before they can detain you.",
          effects: [
            { type: "flag-set", flag: "route-highway-seen" },
            { type: "flag-set", flag: "checkpoint-failed" },
            { type: "meter", meter: "stress", delta: 15 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "A guard detains you briefly for questioning. You talk your way out but lose precious hours and they confiscate some supplies.",
          effects: [
            { type: "flag-set", flag: "route-highway-seen" },
            { type: "flag-set", flag: "checkpoint-failed" },
            { type: "meter", meter: "stress", delta: 25 },
            { type: "time", hours: 3 },
          ],
        },
      ],
    },
    {
      id: "opt-avoid-checkpoint",
      label: "Not worth the risk — find another way",
      outcomes: [
        {
          weight: 1,
          text: "You back away from the highway. There must be other routes north.",
          effects: [
            { type: "flag-set", flag: "route-highway-seen" },
            { type: "flag-set", flag: "checkpoint-avoided" },
          ],
        },
      ],
    },
  ],
};

const routeChoiceBayou: EventDefinition = {
  id: "event.pensacola.route-bayou",
  version: 1,
  title: "The Hidden Trail",
  text: "Between rusted railcars, you spot a narrow path descending into dense vegetation. The air is thick with humidity and the buzz of insects. A hand-painted sign on a fence post reads 'BAYOU TRAIL — NO TRESPASSING.' This path would be nearly invisible from above.",
  tags: ["route", "choice", "stealth", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "route-bayou-seen" },
      {
        field: "visitedNode",
        op: "has",
        value: "node.pensacola.rail-corridor",
      },
    ],
  },
  weight: 40,
  once: true,
  options: [
    {
      id: "opt-enter-bayou",
      label: "Take the bayou trail — stealth over speed",
      outcomes: [
        {
          weight: 1,
          text: "You push through the underbrush. The path is difficult — mud sucks at your feet and branches claw at your pack — but you are invisible. No patrols, no checkpoints. Just you, the water, and the mosquitoes.",
          effects: [
            { type: "flag-set", flag: "route-bayou-seen" },
            { type: "flag-set", flag: "chose-bayou-route" },
            { type: "meter", meter: "fatigue", delta: 15 },
          ],
        },
      ],
    },
    {
      id: "opt-skip-bayou",
      label: "Too slow and dangerous — find a better route",
      outcomes: [
        {
          weight: 1,
          text: "The swamp does not appeal. You turn back toward the rail corridor to look for alternatives.",
          effects: [{ type: "flag-set", flag: "route-bayou-seen" }],
        },
      ],
    },
  ],
};

const routeChoiceIndustrial: EventDefinition = {
  id: "event.pensacola.route-industrial",
  version: 1,
  title: "Through the Warehouses",
  text: "The industrial park stretches along the waterfront — loading docks, chain-link fences, dark warehouses. It is not the fastest route, but the buildings provide cover and the area seems mostly abandoned. Periodic security patrols sweep through on a predictable schedule.",
  tags: ["route", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "route-industrial-seen" },
      {
        field: "visitedNode",
        op: "has",
        value: "node.pensacola.industrial-park",
      },
    ],
  },
  weight: 40,
  once: true,
  options: [
    {
      id: "opt-time-patrols",
      label: "Watch and time the patrol pattern, then move between sweeps",
      check: { attribute: "awareness", difficulty: 10, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You count three passes over twenty minutes, identify the gap, and dart between buildings. The warehouses lead to a service road paralleling the bridge approach. Smart and steady.",
          effects: [
            { type: "flag-set", flag: "route-industrial-seen" },
            { type: "flag-set", flag: "industrial-route-success" },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "You map the entire patrol schedule mentally. You move like a ghost between the warehouses, even finding a stash of supplies someone cached behind a loading dock.",
          effects: [
            { type: "flag-set", flag: "route-industrial-seen" },
            { type: "flag-set", flag: "industrial-route-success" },
            { type: "flag-set", flag: "industrial-stash-found" },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "You misjudge the timing and have to hide behind a dumpster for twenty tense minutes. Eventually you find a gap and make it through, but it takes longer than planned.",
          effects: [
            { type: "flag-set", flag: "route-industrial-seen" },
            { type: "flag-set", flag: "industrial-route-success" },
            { type: "meter", meter: "stress", delta: 10 },
            { type: "time", hours: 2 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "A patrol spots your silhouette. You run through unfamiliar warehouse corridors, slam through a fire door, and emerge on the other side of the complex. Lost but free.",
          effects: [
            { type: "flag-set", flag: "route-industrial-seen" },
            { type: "meter", meter: "stress", delta: 20 },
            { type: "meter", meter: "fatigue", delta: 15 },
            { type: "time", hours: 2 },
          ],
        },
      ],
    },
    {
      id: "opt-go-around",
      label: "Circle around the industrial park entirely",
      outcomes: [
        {
          weight: 1,
          text: "You add distance but avoid the patrols entirely. Sometimes the safest route is the longest one.",
          effects: [
            { type: "flag-set", flag: "route-industrial-seen" },
            { type: "meter", meter: "fatigue", delta: 10 },
            { type: "time", hours: 2 },
          ],
        },
      ],
    },
  ],
};

// ── Mid-journey events ─────────────────────────────────────────────────────

const strangerEncounter: EventDefinition = {
  id: "event.pensacola.stranger-encounter",
  version: 1,
  title: "Someone in the Dark",
  text: "A figure steps out from behind a parked van, hands raised. 'Easy, easy. I am not looking for trouble.' A middle-aged person with a hiking pack and a nervous expression. 'Name is Taylor. I am trying to get north too. Safety in numbers, right?'",
  tags: ["social", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "stranger-met" },
      { field: "elapsedHours", op: "gte", value: 4 },
    ],
  },
  weight: 25,
  once: true,
  options: [
    {
      id: "opt-travel-together",
      label: "Agree to travel together for now",
      outcomes: [
        {
          weight: 1,
          text: "Taylor falls in step beside you. They know the back roads and share some food. Having company eases the weight of the silence. You agree to part ways at the bridge if either of you prefers.",
          effects: [
            { type: "flag-set", flag: "stranger-met" },
            { type: "flag-set", flag: "traveling-with-taylor" },
            { type: "meter", meter: "morale", delta: 10 },
            { type: "meter", meter: "stress", delta: -5 },
          ],
        },
      ],
    },
    {
      id: "opt-decline",
      label: "Decline — travel alone",
      outcomes: [
        {
          weight: 1,
          text: "Taylor nods, clearly disappointed but understanding. 'I get it. Stay safe out there.' They head off in a different direction. You are alone again, but alone is predictable.",
          effects: [
            { type: "flag-set", flag: "stranger-met" },
            { type: "flag-set", flag: "declined-taylor" },
          ],
        },
      ],
    },
  ],
};

const exhaustionCheck: EventDefinition = {
  id: "event.pensacola.exhaustion-check",
  version: 1,
  title: "Hitting the Wall",
  text: "Your legs are heavy and your vision blurs at the edges. You have been moving too long without rest. Pushing further risks injury or poor decisions.",
  tags: ["health", "warning", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "meter.fatigue", op: "gte", value: 70 },
      { field: "flag", op: "not-has", value: "exhaustion-warned" },
    ],
  },
  weight: 60,
  once: true,
  options: [
    {
      id: "opt-rest-now",
      label: "Find a sheltered spot and rest",
      outcomes: [
        {
          weight: 1,
          text: "You duck into an unlocked car and recline the seat. Not comfortable, but sheltered. An hour of rest helps clear the fog from your mind.",
          effects: [
            { type: "flag-set", flag: "exhaustion-warned" },
            { type: "meter", meter: "fatigue", delta: -20 },
            { type: "time", hours: 2 },
          ],
        },
      ],
    },
    {
      id: "opt-push-on",
      label: "Push through — cannot stop now",
      outcomes: [
        {
          weight: 1,
          text: "You force your legs to keep moving. Each step is harder than the last. You will pay for this later.",
          effects: [
            { type: "flag-set", flag: "exhaustion-warned" },
            { type: "meter", meter: "stress", delta: 10 },
            { type: "meter", meter: "health", delta: -5 },
          ],
        },
      ],
    },
  ],
};

const hungerPangs: EventDefinition = {
  id: "event.pensacola.hunger-pangs",
  version: 1,
  title: "Empty Stomach",
  text: "Your stomach growls loudly in the silence. When did you last eat? Hunger makes everything harder — decisions slower, mood darker, body weaker.",
  tags: ["health", "warning", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "meter.hunger", op: "gte", value: 60 },
      { field: "flag", op: "not-has", value: "hunger-warned" },
    ],
  },
  weight: 50,
  once: true,
  options: [
    {
      id: "opt-scavenge-food",
      label: "Search nearby for something to eat",
      check: { attribute: "survival", difficulty: 10, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You find a vending machine with a broken lock. Stale crackers and a warm soda — not gourmet, but calories are calories.",
          effects: [
            { type: "flag-set", flag: "hunger-warned" },
            { type: "meter", meter: "hunger", delta: -20 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "You search but find nothing edible. Wasted effort, but at least now you know to manage your food supply better.",
          effects: [
            { type: "flag-set", flag: "hunger-warned" },
            { type: "meter", meter: "fatigue", delta: 5 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "Behind a restaurant dumpster, sealed containers of day-old bread and fruit. Not pretty, but perfectly safe and filling.",
          effects: [
            { type: "flag-set", flag: "hunger-warned" },
            { type: "meter", meter: "hunger", delta: -30 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "You eat something questionable from an overturned grocery display. Your stomach immediately protests.",
          effects: [
            { type: "flag-set", flag: "hunger-warned" },
            { type: "meter", meter: "hunger", delta: -15 },
            { type: "meter", meter: "health", delta: -5 },
            { type: "meter", meter: "infection", delta: 5 },
          ],
        },
      ],
    },
    {
      id: "opt-ignore-hunger",
      label: "Ignore it and keep moving",
      outcomes: [
        {
          weight: 1,
          text: "You tighten your belt and press on. The body can wait. For now.",
          effects: [
            { type: "flag-set", flag: "hunger-warned" },
            { type: "meter", meter: "stress", delta: 5 },
          ],
        },
      ],
    },
  ],
};

const nightfallDecision: EventDefinition = {
  id: "event.pensacola.nightfall-decision",
  version: 1,
  title: "Darkness Deepens",
  text: "The moon is high now and the streets are quiet — too quiet. Every sound you make seems amplified. Traveling at night keeps you hidden from patrols, but navigation is harder and you might stumble into danger you cannot see.",
  tags: ["time", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "phase", op: "eq", value: "night" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "nightfall-decided" },
    ],
  },
  weight: 30,
  once: true,
  options: [
    {
      id: "opt-keep-moving",
      label: "Keep moving through the night",
      outcomes: [
        {
          weight: 1,
          text: "You push on through the darkness, letting your eyes adjust. Progress is slow but steady, and no one else is moving. The night belongs to you.",
          effects: [
            { type: "flag-set", flag: "nightfall-decided" },
            { type: "flag-set", flag: "night-traveler" },
            { type: "meter", meter: "fatigue", delta: 10 },
          ],
        },
      ],
    },
    {
      id: "opt-wait-dawn",
      label: "Find shelter and wait for dawn",
      outcomes: [
        {
          weight: 1,
          text: "You find a concealed spot and hunker down. Sleep comes in fragments, but even broken rest is better than none. Dawn will bring its own challenges.",
          effects: [
            { type: "flag-set", flag: "nightfall-decided" },
            { type: "meter", meter: "fatigue", delta: -15 },
            { type: "time", hours: 4 },
          ],
        },
      ],
    },
  ],
};

// ── Failure and recovery events ──────────────────────────────────────────────

const injuryEvent: EventDefinition = {
  id: "event.pensacola.injury-stumble",
  version: 1,
  title: "A Bad Step",
  text: "In the darkness, your foot catches on debris. You go down hard, scraping your palms and twisting your ankle. Pain shoots up your leg.",
  tags: ["health", "failure", "recovery", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "meter.fatigue", op: "gte", value: 50 },
      { field: "flag", op: "not-has", value: "injury-occurred" },
      { field: "flag", op: "has", value: "tutorial-started" },
    ],
  },
  weight: 20,
  once: true,
  options: [
    {
      id: "opt-treat-wound",
      label: "Stop and treat the wound",
      outcomes: [
        {
          weight: 1,
          text: "You clean the scrapes with water and bind your ankle with a strip of cloth. It throbs, but you can still walk. Taking time to treat injuries prevents them from becoming worse.",
          effects: [
            { type: "flag-set", flag: "injury-occurred" },
            { type: "flag-set", flag: "injury-treated" },
            { type: "meter", meter: "health", delta: -10 },
            { type: "meter", meter: "pain", delta: 15 },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
    {
      id: "opt-walk-it-off",
      label: "Walk it off — no time to stop",
      outcomes: [
        {
          weight: 1,
          text: "You grit your teeth and keep moving. The ankle swells but holds. Ignoring injuries is a gamble — sometimes they get worse on their own.",
          effects: [
            { type: "flag-set", flag: "injury-occurred" },
            { type: "meter", meter: "health", delta: -15 },
            { type: "meter", meter: "pain", delta: 25 },
          ],
        },
      ],
    },
  ],
};

const caughtByPatrol: EventDefinition = {
  id: "event.pensacola.caught-by-patrol",
  version: 1,
  title: "Spotlight",
  text: "A blinding light pins you in place. 'Do not move!' A patrol has spotted you. Your heart hammers as boots approach on the pavement.",
  tags: ["failure", "recovery", "stealth", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "patrol-encounter" },
      { field: "noiseLevel", op: "gte", value: 8 },
    ],
  },
  weight: 30,
  once: true,
  options: [
    {
      id: "opt-run",
      label: "Run for it",
      check: { attribute: "agility", difficulty: 12, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You bolt sideways, vaulting a low wall and ducking through a yard. The patrol shouts but does not pursue far. You are free, but rattled.",
          effects: [
            { type: "flag-set", flag: "patrol-encounter" },
            { type: "flag-set", flag: "escaped-patrol" },
            { type: "meter", meter: "stress", delta: 15 },
            { type: "meter", meter: "fatigue", delta: 10 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "You vanish into the shadows before they can even react. They sweep the area for a few minutes, then move on. You are already blocks away.",
          effects: [
            { type: "flag-set", flag: "patrol-encounter" },
            { type: "flag-set", flag: "escaped-patrol" },
            { type: "meter", meter: "stress", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "They catch up and hold you for questioning. After an uncomfortable twenty minutes, they let you go with a warning to return to the shelter zone. You lost time but not freedom.",
          effects: [
            { type: "flag-set", flag: "patrol-encounter" },
            { type: "flag-set", flag: "patrol-detained-briefly" },
            { type: "meter", meter: "stress", delta: 25 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "You trip and they are on you immediately. They search your pack and confiscate anything they consider 'restricted.' After a long, tense interaction, they release you. You lost supplies and time.",
          effects: [
            { type: "flag-set", flag: "patrol-encounter" },
            { type: "flag-set", flag: "patrol-confiscated" },
            { type: "meter", meter: "stress", delta: 30 },
            { type: "meter", meter: "morale", delta: -15 },
            { type: "time", hours: 2 },
          ],
        },
      ],
    },
    {
      id: "opt-comply",
      label: "Raise your hands and cooperate",
      outcomes: [
        {
          weight: 1,
          text: "You cooperate calmly. They check your belongings, ask questions, and eventually direct you toward a shelter zone. Once they move on, you slip away and resume your route. Recovery is always possible.",
          effects: [
            { type: "flag-set", flag: "patrol-encounter" },
            { type: "flag-set", flag: "patrol-cooperated" },
            { type: "meter", meter: "stress", delta: 15 },
            { type: "time", hours: 2 },
          ],
        },
      ],
    },
  ],
};

const dehydrationCrisis: EventDefinition = {
  id: "event.pensacola.dehydration-crisis",
  version: 1,
  title: "Parched",
  text: "Your mouth is dry as cotton and a headache pulses behind your eyes. Dehydration is becoming a serious problem. You need water soon or your condition will deteriorate rapidly.",
  tags: ["health", "failure", "recovery", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "meter.thirst", op: "gte", value: 80 },
      { field: "flag", op: "not-has", value: "dehydration-crisis" },
    ],
  },
  weight: 70,
  once: true,
  options: [
    {
      id: "opt-desperate-search",
      label: "Desperately search for water",
      check: { attribute: "survival", difficulty: 8, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You find a half-crushed water bottle under a car seat. It is warm and tastes like plastic, but it is clean. Crisis averted, but barely.",
          effects: [
            { type: "flag-set", flag: "dehydration-crisis" },
            { type: "meter", meter: "thirst", delta: -25 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "You search for twenty minutes and find nothing. Your headache worsens. You need to find water at the next stop or face serious consequences.",
          effects: [
            { type: "flag-set", flag: "dehydration-crisis" },
            { type: "meter", meter: "health", delta: -10 },
            { type: "meter", meter: "stress", delta: 10 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "A garden rain barrel behind a house still holds clean water. You drink deeply and fill your containers. The headache recedes. Lucky break.",
          effects: [
            { type: "flag-set", flag: "dehydration-crisis" },
            { type: "meter", meter: "thirst", delta: -40 },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "You find a puddle and in desperation drink from it. The water is foul. Your thirst eases slightly but your stomach rebels.",
          effects: [
            { type: "flag-set", flag: "dehydration-crisis" },
            { type: "meter", meter: "thirst", delta: -15 },
            { type: "meter", meter: "health", delta: -10 },
            { type: "meter", meter: "infection", delta: 15 },
          ],
        },
      ],
    },
    {
      id: "opt-push-through-thirst",
      label: "Endure it — water will come",
      outcomes: [
        {
          weight: 1,
          text: "You push on despite the pounding headache. Each step is a little harder. You are gambling with your health now.",
          effects: [
            { type: "flag-set", flag: "dehydration-crisis" },
            { type: "meter", meter: "health", delta: -10 },
            { type: "meter", meter: "stress", delta: 10 },
          ],
        },
      ],
    },
  ],
};

const lostInDark: EventDefinition = {
  id: "event.pensacola.lost-in-dark",
  version: 1,
  title: "Turned Around",
  text: "The streets all look the same in the dark. You have been walking in circles — the same graffiti on the same wall, twice now. Without landmarks or a working compass, navigation is guesswork.",
  tags: ["navigation", "failure", "recovery", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "phase", op: "eq", value: "night" },
      { field: "flag", op: "has", value: "tutorial-stealth-done" },
      { field: "flag", op: "not-has", value: "got-lost" },
    ],
  },
  weight: 15,
  once: true,
  options: [
    {
      id: "opt-stop-orient",
      label: "Stop and use the stars to orient yourself",
      check: { attribute: "survival", difficulty: 10, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You find the North Star and reorient. The bridge should be that way. You adjust your course and start making progress again.",
          effects: [
            { type: "flag-set", flag: "got-lost" },
            { type: "flag-set", flag: "reoriented" },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "Cloud cover obscures the stars. You guess a direction and keep moving. It takes another wrong turn before you finally recognize a landmark.",
          effects: [
            { type: "flag-set", flag: "got-lost" },
            { type: "flag-set", flag: "reoriented" },
            { type: "meter", meter: "stress", delta: 10 },
            { type: "meter", meter: "fatigue", delta: 10 },
            { type: "time", hours: 2 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "You spot the North Star immediately and even notice the glow of the bridge lights to the north. You are closer than you thought.",
          effects: [
            { type: "flag-set", flag: "got-lost" },
            { type: "flag-set", flag: "reoriented" },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "You walk for an hour before realizing you have been heading south. Precious time wasted. Frustration wells up.",
          effects: [
            { type: "flag-set", flag: "got-lost" },
            { type: "flag-set", flag: "reoriented" },
            { type: "meter", meter: "stress", delta: 15 },
            { type: "meter", meter: "fatigue", delta: 15 },
            { type: "meter", meter: "morale", delta: -10 },
            { type: "time", hours: 3 },
          ],
        },
      ],
    },
    {
      id: "opt-wait-for-light",
      label: "Wait until dawn when you can see landmarks",
      outcomes: [
        {
          weight: 1,
          text: "You shelter and wait. Dawn reveals your position — you were only two blocks from where you needed to be. Rest gained, time spent.",
          effects: [
            { type: "flag-set", flag: "got-lost" },
            { type: "flag-set", flag: "reoriented" },
            { type: "meter", meter: "fatigue", delta: -10 },
            { type: "time", hours: 4 },
          ],
        },
      ],
    },
  ],
};

// ── Bridge approach / chapter exit events ────────────────────────────────────

const bridgeApproach: EventDefinition = {
  id: "event.pensacola.bridge-approach",
  version: 1,
  title: "The Bridge Ahead",
  text: "Through a gap in the buildings, you see it: the North Bridge, stretching across the dark water. On the far side, pine trees line the road heading north. Freedom — or at least the next leg of the journey. But the bridge is a chokepoint, and you are not the only one who knows it.",
  tags: ["story", "exit", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "visitedNode", op: "has", value: "node.pensacola.north-bridge" },
      { field: "flag", op: "not-has", value: "bridge-approached" },
    ],
  },
  weight: 90,
  once: true,
  options: [
    {
      id: "opt-cross-now",
      label: "Cross immediately while it is quiet",
      outcomes: [
        {
          weight: 1,
          text: "You step onto the bridge. The pavement is cracked and the guardrails are bent, but the structure holds. Each step takes you further from Pensacola and closer to the open road north. The wind off the bay smells like salt and possibility.",
          effects: [
            { type: "flag-set", flag: "bridge-approached" },
            { type: "flag-set", flag: "bridge-crossed-early" },
            { type: "meter", meter: "morale", delta: 10 },
          ],
        },
      ],
    },
    {
      id: "opt-scout-first",
      label: "Watch the bridge for activity before crossing",
      check: { attribute: "awareness", difficulty: 8, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "success",
          text: "You observe for ten minutes. A pair of figures cross from the other direction, moving quickly. No patrols visible. You pick your moment and cross safely.",
          effects: [
            { type: "flag-set", flag: "bridge-approached" },
            { type: "flag-set", flag: "bridge-scouted" },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "failure",
          text: "You watch, but it is too dark to see clearly. Eventually you decide to just go for it. You cross without incident, though your nerves are frayed.",
          effects: [
            { type: "flag-set", flag: "bridge-approached" },
            { type: "meter", meter: "stress", delta: 5 },
            { type: "time", hours: 1 },
          ],
        },
        {
          weight: 1,
          tier: "critical-success",
          text: "You spot a patrol schedule — they sweep the bridge every thirty minutes. You time your crossing perfectly, unseen.",
          effects: [
            { type: "flag-set", flag: "bridge-approached" },
            { type: "flag-set", flag: "bridge-scouted" },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
        {
          weight: 1,
          tier: "critical-failure",
          text: "While watching, a patrol walks right past your position. You flatten against the concrete and hold your breath until they pass. Then you scramble across.",
          effects: [
            { type: "flag-set", flag: "bridge-approached" },
            { type: "meter", meter: "stress", delta: 15 },
            { type: "time", hours: 1 },
          ],
        },
      ],
    },
  ],
};

const chapterEnd: EventDefinition = {
  id: "event.pensacola.chapter-end",
  version: 1,
  title: "Looking North",
  text: "The road opens up beyond the bridge. Pensacola fades behind you — its dark skyline, its checkpoints, its chaos. Ahead, the pine forest stretches endlessly along the highway. You are out. Not safe, not home, but out. The first chapter of your journey is complete.",
  tags: ["story", "exit", "chapter-end", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "visitedNode", op: "has", value: "node.pensacola.exit-north" },
      { field: "flag", op: "has", value: "bridge-approached" },
      { field: "flag", op: "not-has", value: "chapter-complete" },
    ],
  },
  weight: 100,
  once: true,
  options: [
    {
      id: "opt-keep-going",
      label: "Keep moving north — no looking back",
      outcomes: [
        {
          weight: 1,
          text: "You set your jaw and walk. Behind you, a city in crisis. Ahead, a thousand miles of uncertain road. But somewhere at the end of it, family is waiting. That is enough.",
          effects: [
            { type: "flag-set", flag: "chapter-complete" },
            { type: "meter", meter: "morale", delta: 10 },
          ],
        },
      ],
    },
    {
      id: "opt-pause-remember",
      label: "Pause and take one last look at the city",
      outcomes: [
        {
          weight: 1,
          text: "You turn for a moment. Pensacola is just a dark shape against the sky now. Somewhere in there, people are still struggling. You hope they find their way too. Then you face north and start walking.",
          effects: [
            { type: "flag-set", flag: "chapter-complete" },
            { type: "meter", meter: "stress", delta: -5 },
            { type: "meter", meter: "morale", delta: 15 },
          ],
        },
      ],
    },
  ],
};

// ── Additional flavor events to reach 24 total ──────────────────────────────

const dogEncounter: EventDefinition = {
  id: "event.pensacola.stray-dog",
  version: 1,
  title: "A Stray Dog",
  text: "A thin, mud-caked dog trots up and sits at your feet, tail wagging hopefully. It looks hungry and lost — like most living things in Pensacola right now.",
  tags: ["flavor", "choice", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-started" },
      { field: "flag", op: "not-has", value: "dog-encountered" },
    ],
  },
  weight: 15,
  once: true,
  options: [
    {
      id: "opt-share-food",
      label: "Share some food with the dog",
      outcomes: [
        {
          weight: 1,
          text: "The dog gobbles the morsel and licks your hand. It follows you for a while, a warm presence in the dark. Eventually it spots something and veers off. A small kindness in a harsh world.",
          effects: [
            { type: "flag-set", flag: "dog-encountered" },
            { type: "meter", meter: "morale", delta: 10 },
            { type: "meter", meter: "hunger", delta: 5 },
          ],
        },
      ],
    },
    {
      id: "opt-ignore-dog",
      label: "Keep moving — you cannot afford distractions",
      outcomes: [
        {
          weight: 1,
          text: "You walk past the dog, which watches you go with sad eyes. Survival demands difficult choices.",
          effects: [{ type: "flag-set", flag: "dog-encountered" }],
        },
      ],
    },
  ],
};

const quietMoment: EventDefinition = {
  id: "event.pensacola.quiet-moment",
  version: 1,
  title: "A Moment of Stillness",
  text: "For the first time in hours, everything is completely still. No sirens, no shouting, no engines. Just the wind rustling through palm trees and the distant crash of waves. Above, more stars than you have ever seen in the city — without the light pollution, the sky is breathtaking.",
  tags: ["flavor", "pensacola"],
  trigger: {
    all: [
      { field: "chapter", op: "eq", value: "pensacola-escape" },
      { field: "flag", op: "has", value: "tutorial-started" },
      { field: "flag", op: "not-has", value: "quiet-moment-had" },
      { field: "phase", op: "eq", value: "night" },
    ],
  },
  weight: 10,
  once: true,
  options: [
    {
      id: "opt-appreciate",
      label: "Take a moment to breathe",
      outcomes: [
        {
          weight: 1,
          text: "You close your eyes and just breathe. The world is broken, but it is still beautiful. That has to mean something. When you open your eyes, you feel slightly more centered.",
          effects: [
            { type: "flag-set", flag: "quiet-moment-had" },
            { type: "meter", meter: "stress", delta: -10 },
            { type: "meter", meter: "morale", delta: 5 },
          ],
        },
      ],
    },
    {
      id: "opt-keep-moving-quiet",
      label: "No time for contemplation",
      outcomes: [
        {
          weight: 1,
          text: "Beautiful skies do not get you north. You keep walking.",
          effects: [{ type: "flag-set", flag: "quiet-moment-had" }],
        },
      ],
    },
  ],
};

// ── Export registry ──────────────────────────────────────────────────────────

/** All 24 Pensacola tutorial event definitions, ready for setEventRegistry(). */
export const PENSACOLA_EVENTS: ReadonlyArray<EventDefinition> = [
  // Opening / tutorial (4)
  tutorialWakeUp,
  tutorialTipMovement,
  tutorialTipSupplies,
  tutorialTipStealth,
  // Family signal (1)
  familySignal,
  // Supply and transport choices (3)
  abandonedBicycle,
  scavengeOpportunity,
  waterSource,
  // Route / exit choices (3)
  routeChoiceHighway,
  routeChoiceBayou,
  routeChoiceIndustrial,
  // Mid-journey (4)
  strangerEncounter,
  exhaustionCheck,
  hungerPangs,
  nightfallDecision,
  // Failure and recovery (4)
  injuryEvent,
  caughtByPatrol,
  dehydrationCrisis,
  lostInDark,
  // Bridge / chapter exit (2)
  bridgeApproach,
  chapterEnd,
  // Flavor (2) — total: 24 (exceeds required 20+)
  dogEncounter,
  quietMoment,
];
