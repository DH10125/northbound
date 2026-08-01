# Content system

## Purpose

Writers create variety without changing engine logic. All content is typed, validated, deterministic, referentially sound, and reviewable in Git.

## Stable IDs

Use lowercase dot-separated IDs: `event.lower-mississippi.derelict-barge`, `item.medical.bandage`, `node.pensacola.marina`. IDs never encode display copy and are not reused after removal.

## Event contract

```ts
type EventDefinition = {
  id: string;
  version: number;
  title: string;
  text: string;
  tags: string[];
  trigger: ConditionTree;
  weight: number;
  cooldownTurns?: number;
  once?: boolean;
  options: EventOption[]; // 2–6
};

type EventOption = {
  id: string;
  label: string;
  requirements?: ConditionTree;
  check?: SkillCheck;
  outcomes: WeightedOutcome[];
};
```

Outcomes use an allow-listed effect vocabulary: resources, time, meters, condition stage, item/transport damage, flags, reputation, relationship, pursuit, relocation, follow-up, companion join/leave, and run/finale state. Narrative never executes code.

## Conditions

Composable `all`/`any`/`not` trees may inspect chapter/node/terrain/phase/weather, numeric state ranges, inventory/tag quantities, party/companion, transport, faction reputation, flags, prior event, difficulty, and farm state. Validators reject unknown keys, circular chains, impossible ranges, missing references, and options with no reachable outcome.

## Skill checks

Checks name an attribute or derived skill, difficulty, modifiers, and disclosure level. RNG rolls once and maps to critical failure/failure/success/critical success. Text should communicate risk without exposing exact odds unless settings permit.

## Authoring rules

- Give every choice a meaningful tradeoff; avoid false choices.
- Telegraph lethal or irreversible risk.
- Include nonviolent approaches where fiction permits.
- Never punish identity/pronoun choices.
- Use fictional actors for culpability and avoid operational attack detail.
- Keep prose concise, readable on mobile, and suitable for screen readers.
- Separate symptoms from diagnosis and avoid prescriptive medical claims.
- Follow-up events check that their setup flags exist.
- Content with suicide, child harm, severe illness, or animal death gets a sensitivity tag and settings-aware presentation.

## Packs

Organize by `core`, chapter, companions, factions, medical, finale. A manifest declares pack version, definitions, and dependencies. Load order does not affect weighted results; candidates are sorted by stable ID before seeded selection.

## Validation report

The content check reports schema errors, duplicate/missing IDs, route reachability, event option counts, chain cycles, orphan flags, unavailable items, missing copy, and distribution summaries by chapter/tag/risk. CI fails on errors and prints warnings for balance review.

## Content review checklist

Schema passes; voice matches; choices differ; costs are explicit enough; checks offer fallback; persistent effects are documented; references resolve; accessibility/sensitivity reviewed; deterministic fixture updated when necessary.
