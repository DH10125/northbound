# Roadmap: exactly 38 Claude-ready chunks

GitHub issues are the execution source. The milestones below are sequential; issue bodies define dependencies and acceptance criteria. Never combine issues merely to move faster.

## M0 — Foundation (01–05)

1. Repository policy and Next.js baseline
2. Quality gates and CI
3. Design tokens, shell, and accessibility baseline
4. Core domain types and schemas
5. Seeded RNG, commands, reducer, and replay harness

## M1 — Vertical Slice (06–12)

6. Character creation
7. Turn clock and day/night action loop
8. Inventory, storage, and encumbrance
9. Route graph and travel resolution
10. Event engine and choice resolution
11. Conditions, injury, illness, and treatment
12. Pensacola tutorial vertical slice

Exit: a seeded tutorial can be played, saved, resumed, and tested end-to-end.

## M2 — Survival Systems (13–20)

13. Weather, environment, exposure, and contamination
14. Stealth, concealment, detection, and pursuit
15. Transport, durability, repair, fuel, and portage
16. Salvage, forage, hunt, fish, craft, and water treatment
17. Encounters and nonviolent conflict options
18. Turn-based combat, wounds, capture, and retreat
19. Companions, relationships, morale, and conflict
20. Factions, reputation, trade, tolls, and promises

## M3 — Journey Content (21–28)

21. Content pipeline, manifests, and validation reports
22. Gulf Coast / Deep South chapter pack
23. Lower Mississippi chapter pack
24. Middle Mississippi chapter pack
25. Upper Mississippi chapter pack
26. Wisconsin Waterways chapter pack
27. Companion story arcs and interjections
28. Global crisis, rumor, radio, and linked event chains

## M4 — Complete Game (29–33)

29. Farm deterioration clock and remote family state
30. Butternut finale scenarios and stabilization gameplay
31. Endings, journey summary, statistics, and run archive
32. Save migrations, autosave slots, import/export, and recovery
33. Difficulty, accessibility, content controls, and settings

## M5 — v1.0 Release (34–38)

34. Audio, motion, visual polish, and original asset pass
35. Balance tools, deterministic simulations, and tuning pass
36. Performance, responsive layout, PWA, and offline resilience
37. Security, privacy, dependency, and release QA audit
38. Vercel production release and v1.0 launch checklist

Exit: CI-green, accessible, documented, Vercel-ready v1.0 with no required secrets.

## Label taxonomy

Type: `type: infrastructure`, `type: engine`, `type: ui`, `type: content`, `type: testing`, `type: release`. Area: `area: core`, `area: narrative`, `area: accessibility`, `area: persistence`, `area: deployment`. Priority: `priority: critical`, `priority: high`, `priority: normal`. Workflow: `status: ready`, `status: blocked`, `claude-ready`.

## Project fields

Recommended GitHub Project: Status (Backlog/Ready/In progress/In review/Done), Milestone, Priority, Area, Issue, Dependencies. Project creation is optional when the authenticated GitHub surface does not support it; the numbered milestones remain authoritative.
