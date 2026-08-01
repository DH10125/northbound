# Issue seed — exactly 38 development chunks

Every issue is `claude-ready`. Dependencies refer to these planned issue numbers. Shared completion gate: acceptance criteria pass; format, lint, strict typecheck, relevant tests, and production build pass; documentation and screenshots are updated where relevant.

## 01 — Initialize repository policy and Vercel-ready Next.js baseline

**Milestone:** M0 — Foundation · **Labels:** type: infrastructure, priority: critical, status: ready, claude-ready · **Depends on:** none

Create Next.js App Router + strict TypeScript + Tailwind package baseline, scripts, lockfile, metadata, error/not-found pages, and Vercel-compatible build with no required secrets. Preserve all planning docs and templates. **Accept:** clean install and dev/build work; home page identifies Northbound and links product principles; Node version and package manager are documented; no runtime warnings.

## 02 — Add quality gates, tests, and CI

**Milestone:** M0 — Foundation · **Labels:** type: testing, type: infrastructure, priority: critical, claude-ready · **Depends on:** 01

Configure formatter, ESLint, Vitest/Testing Library, Playwright smoke setup, coverage output, and CI caching. **Accept:** scripts for format check, lint, typecheck, unit test, E2E, and build; a unit/component/smoke example passes; CI uses least permissions and fails on each gate; contributor docs match commands.

## 03 — Build design tokens, application shell, and accessibility baseline

**Milestone:** M0 — Foundation · **Labels:** type: ui, area: accessibility, priority: high, claude-ready · **Depends on:** 01, 02

Create original visual language, responsive shell, tokens, typography, focus styles, dialogs/toasts/status primitives, reduced motion, and live-region conventions. **Accept:** 320px through desktop layouts; keyboard-visible focus; AA contrast; non-color status; light/dark preference; component accessibility tests; no copied game trade dress.

## 04 — Define core domain types and Zod schemas

**Milestone:** M0 — Foundation · **Labels:** type: engine, area: core, priority: critical, claude-ready · **Depends on:** 01, 02

Implement schemas/types for IDs, player, party, meters, inventory, transport, route, world, factions, events, farm, settings, and versioned GameState. **Accept:** valid minimal fixture; malformed and dangling data rejected with paths; types inferred from schemas where practical; stable ID convention documented; schemas contain no React/browser dependency.

## 05 — Implement seeded RNG, commands, reducer, and replay harness

**Milestone:** M0 — Foundation · **Labels:** type: engine, area: core, priority: critical, claude-ready · **Depends on:** 04

Build serializable PRNG, command validation, pure reducer, domain-event journal, selectors, and replay fixture. **Accept:** same seed+commands yields byte-equivalent relevant state; RNG helpers cover weighted choice/shuffle/range boundaries; invalid commands do not mutate state; replay divergence reports turn; no wall-clock/random globals in core.

## 06 — Implement character creation and occupations

**Milestone:** M1 — Vertical Slice · **Labels:** type: ui, type: engine, priority: high, claude-ready · **Depends on:** 03, 05

Create accessible creation flow for identity, occupation, motivation, and weakness; encode eight occupations and derived attributes. **Accept:** back/forward preserves selections; summaries explain tradeoffs; Tourist is marked challenge, not joke; pronouns render correctly; valid player initializes deterministic state; keyboard/mobile tests.

## 07 — Implement turn clock and night/day action loop

**Milestone:** M1 — Vertical Slice · **Labels:** type: engine, area: core, priority: critical, claude-ready · **Depends on:** 05, 06

Implement 2–6 hour turns, phase transitions, action availability, meter upkeep, farm clock tick, and resolution summary. **Accept:** travel biased to night and recovery/day actions encoded by rules; time cannot skip/duplicate; resource costs and meter clamps tested; disabled actions explain why; summaries announce changes accessibly.

## 08 — Implement inventory, storage, and encumbrance

**Milestone:** M1 — Vertical Slice · **Labels:** type: engine, type: ui, priority: high, claude-ready · **Depends on:** 04, 07

Add item definitions, stacks, condition/spoilage, weight/volume, storage transfers, consumption, and capacity effects. **Accept:** 25 starter items across core categories; atomic transfers; capacity/noise affect selectors; spoilage advances deterministically; touch/keyboard inventory usable; invariants prevent duplication/negative quantities.

## 09 — Implement route graph and travel resolution

**Milestone:** M1 — Vertical Slice · **Labels:** type: engine, type: ui, area: core, priority: critical, claude-ready · **Depends on:** 07, 08

Create typed node/edge graph, route choice UI, travel progress, terrain/method constraints, navigation uncertainty, and chapter transitions. **Accept:** initial Pensacola subgraph has 8+ nodes and meaningful branches; validators catch unreachable/invalid edges; distance/time/resources/wear resolve; current/next risks readable without a GPS simulation.

## 10 — Implement event engine and choice resolution

**Milestone:** M1 — Vertical Slice · **Labels:** type: engine, area: narrative, priority: critical, claude-ready · **Depends on:** 05, 07, 09

Implement candidate filtering, stable weighted selection, conditions/checks, 2–6 options, outcomes/effects, cooldown/once flags, follow-ups, and event UI. **Accept:** seeded selection stable regardless of content load order; unavailable options explain requirements; effects apply atomically; no-event outcome supported; tests cover success tiers and chains.

## 11 — Implement conditions, illness, injury, and treatment

**Milestone:** M1 — Vertical Slice · **Labels:** type: engine, type: ui, priority: high, claude-ready · **Depends on:** 07, 08, 10

Add staged conditions, symptom visibility by medical skill, risk/progression/recovery, treatment/rest, and long-term effects. Seed representative dehydration, heat illness, dysentery, wound infection, fracture, smoke exposure. **Accept:** no medical-advice framing; untreated progression and treatment costs deterministic; uncertainty shown; severe risks telegraphed; permanent modifiers persist.

## 12 — Deliver playable Pensacola tutorial vertical slice

**Milestone:** M1 — Vertical Slice · **Labels:** type: content, type: ui, priority: critical, claude-ready · **Depends on:** 06–11

Author tutorial opening, 20+ events, first family signal, supplies/transport choices, stealth lesson, multiple exits, and failure/recovery states. **Accept:** 30–45 minute seeded slice playable from creation to chapter exit; teaching is contextual/skippable; at least three viable routes; save/resume smoke test; original polished copy; E2E golden path and recovery path.

## 13 — Add weather, environment, exposure, and contamination

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, area: core, priority: high, claude-ready · **Depends on:** 11, 12

Implement region/season weather, temperature, smoke, drought, storms, flood releases, chemical/radiation/water contamination and protection. **Accept:** forecasts are imperfect; environment affects route/actions/conditions/events; contamination has detectable uncertainty and mitigation; 10 representative hazards; deterministic tests and clear non-color UI.

## 14 — Add stealth, concealment, detection, and pursuit

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, type: ui, priority: critical, claude-ready · **Depends on:** 09, 10, 13

Model visibility/noise, moon/weather/terrain, group/transport, hiding quality, scouting, detection, pursuit decay/escalation, and consequences. **Accept:** risk preview explains major contributors; at least six concealment types; light/fire/gunfire matter; discovery supports theft/toll/capture/ambush; stealth and pursuit replay deterministically.

## 15 — Add transport, durability, repair, fuel, and portage

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, type: ui, priority: high, claude-ready · **Depends on:** 08, 09, 13

Implement 14 variants across foot/road/water, cargo/passengers, noise/visibility, reliability, current, fuel, damage, repair/parts, switching/abandonment, and portage. **Accept:** route method compatibility enforced; failures never strand without a surfaced option; occupation skill affects repairs; upstream/portage tradeoffs; transport UI and rule matrices tested.

## 16 — Add salvage, forage, hunt, fish, craft, and water treatment

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, type: content, priority: normal, claude-ready · **Depends on:** 08, 09, 13

Create location-sensitive gathering actions, risk/time/noise, tool/skill checks, depletion, recipes, cooking, filtration/boiling/tablets, and spoilage. **Accept:** no infinite-resource loop; yields scale by terrain/season/skill; failures can consume time or expose risk; 15 recipes/actions; recipe and balance-envelope validation.

## 17 — Build encounters and nonviolent conflict options

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, area: narrative, priority: high, claude-ready · **Depends on:** 10, 14, 16

Add observe, avoid, negotiate, trade, deceive, intimidate, distract, surrender, flee, and terrain options with intent/stakes and memory. **Accept:** shared encounter contract; hidden information affected by awareness; NPC goals drive offers; outcomes change flags/reputation/pursuit; 12 encounter fixtures; nonviolence is viable, not cosmetic.

## 18 — Add turn-based combat, wounds, capture, and retreat

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, type: ui, priority: high, claude-ready · **Depends on:** 11, 14, 17

Implement short tactical rounds, initiative, cover/range, melee/ranged, aid, ammo/durability, morale, retreat/surrender, wounds, noise, defeat alternatives, and death. **Accept:** combat avoidable in fixtures; no gore-forward presentation; predictable action preview; capture/robbery/separation states; AI uses legal actions; deterministic replay and accessibility tests.

## 19 — Add companions, relationships, morale, and conflict

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, area: narrative, priority: high, claude-ready · **Depends on:** 06, 11, 17, 18

Model companion skills/needs, loyalty/fear/morale, objectives/boundaries, pairwise relations, orders/refusal, join/leave, interjections, guard/carry/care roles. **Accept:** recruit capacity and inventory work; reactions arise from tagged choices; low morale has legible causes; conflict offers resolution; six companion schemas/fixtures; departure never corrupts items/state.

## 20 — Add factions, reputation, trade, tolls, and promises

**Milestone:** M2 — Survival Systems · **Labels:** type: engine, area: narrative, priority: high, claude-ready · **Depends on:** 17, 19

Implement eight fictional faction archetypes, reputation/debt/promises, territory/access, dynamic prices, trade UI, tolls, disguises, and inter-faction tension. **Accept:** no good/evil scalar; prices/reactions explain drivers; promises persist and can expire/break; hostile status still offers alternatives; economy blocks duplication/arbitrage exploits in tests.

## 21 — Build content packs, authoring tools, and validation reports

**Milestone:** M3 — Journey Content · **Labels:** type: infrastructure, area: narrative, priority: critical, claude-ready · **Depends on:** 10, 13–20

Implement pack manifests, schemas, reference/graph/chain/orphan validation, deterministic load order, fixtures, and CLI report with distribution summaries. **Accept:** error locations actionable; duplicate/missing/cyclic/impossible content fails CI; warnings cover chapter/risk/option distribution; sample authoring docs; engine imports through a single content registry.

## 22 — Author Gulf Coast / Deep South chapter pack

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: high, claude-ready · **Depends on:** 21

Add 8+ nodes, 12+ edges, 25+ events around heat, water, mosquitoes, rural/rail/highway choices, rumors, swamps, farms, and industrial risk. **Accept:** three viable route styles; local tone avoids stereotypes; transport/stealth/medical systems exercised; two linked chains; chapter entry/exit and content distributions validate.

## 23 — Author Lower Mississippi chapter pack

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: high, claude-ready · **Depends on:** 21, 22

Add 8+ nodes, 12+ edges, 25+ events for upstream current, levees, debris, patrols, contamination, islands, damaged craft, fuel and crossings. **Accept:** water and riverbank routes both viable; acquisition/abandonment of boats; two linked chains; current/portage rules used; no literal navigation claim; validation and seeded chapter test.

## 24 — Author Middle Mississippi chapter pack

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: high, claude-ready · **Depends on:** 21, 23

Add 8+ nodes, 12+ edges, 25+ events emphasizing settlements, ports, tolls, trade, piracy, factions, bridges, islands, and moral obligations. **Accept:** at least three faction strategies; promises have later hooks; combat avoidable; economy/resource pressure tested; two linked chains and validation pass.

## 25 — Author Upper Mississippi chapter pack

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: high, claude-ready · **Depends on:** 21, 24

Add 7+ nodes, 10+ edges, 22+ events for cold, bluffs, locks/dams, low water, portage, scarcity, wildlife, and leaving the main river. **Accept:** seasonal cold transition legible; route exit has multiple methods/costs; two linked chains; avoids glorifying dangerous dam access; validation and seeded chapter test.

## 26 — Author Wisconsin Waterways chapter pack

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: high, claude-ready · **Depends on:** 21, 25

Add 7+ nodes, 10+ edges, 22+ events for fictionalized Chippewa/Flambeau connections, logging trails, rapids, portage, cold forest, isolation, injury, and exhaustion. **Accept:** plausible fiction disclaimer; overland and water tradeoffs; Butternut approach reachable by multiple states; two linked chains; validation and seeded test.

## 27 — Author companion arcs and contextual interjections

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: normal, claude-ready · **Depends on:** 19, 21–26

Write recruit/goal/crisis/resolution arcs for Marisol, Cole, Eli, Warren, Tasha, and Noah plus pairwise tensions and regional comments. **Accept:** 6 arcs with at least 5 beats each; boundaries and objectives affect choices; no companion is purely a stat bundle; alternate departure/death states safe; repetition/cooldowns validated; sensitivity review recorded.

## 28 — Add global crisis updates, rumors, radio, and linked chains

**Milestone:** M3 — Journey Content · **Labels:** type: content, area: narrative, priority: normal, claude-ready · **Depends on:** 21–27

Create unreliable rumors, radio repair/listening, family signals, faction broadcasts, global deterioration updates, and 20 total linked chains across packs. **Accept:** source reliability is communicated; information unlocks choices/routes without omniscience; fictional attribution consistent; chains recover from missed beats; radio has power/time/detection costs; validation passes.

## 29 — Implement farm deterioration clock and remote family state

**Milestone:** M4 — Complete Game · **Labels:** type: engine, area: narrative, priority: critical, claude-ready · **Depends on:** 07, 20, 28

Model uncertain family status, livestock, well/pumps, crops, seed, fuel, security, fire, and occupancy over time; let signals and choices modify knowledge/state. **Accept:** deterioration is urgent but not a single hidden death timer; forecasts show ranges; journey choices can help/harm; difficulty tuning hooks; deterministic scenarios and no unwinnable state without warning/recovery.

## 30 — Build Butternut finale and farm stabilization gameplay

**Milestone:** M4 — Complete Game · **Labels:** type: engine, type: content, priority: critical, claude-ready · **Depends on:** 26–29

Create farm arrival assessment, 8 finale scenarios, prioritized stabilization actions, family/occupier/faction/companion decisions, and multi-turn resolution. **Accept:** arrival is not automatic victory; brought items/skills/people matter; at least three noncombat resolutions to occupation; animal harm handled sensitively; all scenario entry states finish without deadlock; E2E finale fixtures.

## 31 — Add endings, journey summary, statistics, and local run archive

**Milestone:** M4 — Complete Game · **Labels:** type: ui, area: narrative, priority: high, claude-ready · **Depends on:** 30

Evaluate outcome dimensions and generate 12+ coherent ending summaries, timeline highlights, companion/faction/farm epilogues, stats, seed and accessible share text; keep a small local archive. **Accept:** ending reflects flags rather than score alone; avoids contradictory paragraphs; share works without server; archive deletion/export controlled by user; snapshot tests cover representative endings.

## 32 — Harden save migrations, autosave slots, import/export, and recovery

**Milestone:** M4 — Complete Game · **Labels:** type: engine, area: persistence, priority: critical, claude-ready · **Depends on:** 05, 07, 21, 31

Implement versioned envelope/checksum, three autosave slots, explicit continue/new-run behavior, manual export/import, forward migrations, corruption recovery, and quota handling. **Accept:** atomic save at safe boundaries; incompatible/corrupt import cannot damage slots; migrations pure/tested from every fixture; import size-limited; seed/replay preserved; accessible recovery UI.

## 33 — Add difficulty, accessibility, content controls, and settings

**Milestone:** M4 — Complete Game · **Labels:** type: ui, area: accessibility, priority: high, claude-ready · **Depends on:** 03, 31, 32

Add three pressure/transparency presets and granular settings for text, contrast, motion, sound, risk disclosure, input, and sensitive content presentation. **Accept:** presets do not merely scale damage; settings can change mid-run without invalidating seed; content controls preserve mechanical clarity; keyboard/touch/screen-reader audit; settings persist separately and export safely.

## 34 — Complete audio, motion, visual polish, and original asset pass

**Milestone:** M5 — v1.0 Release · **Labels:** type: ui, type: content, priority: normal, claude-ready · **Depends on:** 12, 22–33

Create original maps/icons/illustrations/ambient audio/UI cues, transitions, loading/empty/error states, credits and asset provenance. **Accept:** no copied assets/trade dress; audio optional and captioned/text-equivalent; reduced motion removes nonessential movement; assets optimized/licensed; visual hierarchy consistent across all screens; no polish blocks play.

## 35 — Add balance tools, seeded simulations, and tuning pass

**Milestone:** M5 — v1.0 Release · **Labels:** type: testing, area: core, priority: critical, claude-ready · **Depends on:** 21–34

Build headless run simulation, scenario matrix, distribution reports, resource/illness/combat/farm metrics, and tune three presets without changing narrative identity. **Accept:** thousands of seeded runs reproducible; report completion/failure causes by chapter/occupation/route; no dominant occupation or mandatory combat; target run length and content exposure measured; tuning constants documented.

## 36 — Optimize performance, responsive layout, PWA, and offline resilience

**Milestone:** M5 — v1.0 Release · **Labels:** type: infrastructure, type: ui, area: deployment, priority: high, claude-ready · **Depends on:** 34, 35

Measure/optimize bundle, rendering, content loading, images/fonts; add manifest/icons/installability and safe offline shell/save behavior. **Accept:** agreed Lighthouse budgets documented and met on representative mobile; no layout overflow at 320px; initial route avoids loading all heavy assets; offline refresh communicates limitations; updates do not corrupt saves; Vercel preview smoke passes.

## 37 — Perform security, privacy, dependency, accessibility, and release QA audit

**Milestone:** M5 — v1.0 Release · **Labels:** type: testing, type: release, priority: critical, claude-ready · **Depends on:** 32–36

Audit imports/XSS, client secrets, dependencies/licenses, privacy/telemetry, save corruption, browser matrix, full keyboard/screen-reader/mobile journeys, content/sensitivity, and release docs. **Accept:** no high/critical findings; no telemetry or secrets; dependency/license inventory; supported browsers documented; all 38 issue acceptance evidence traceable; regression suite and manual checklist green.

## 38 — Release Northbound v1.0 to Vercel

**Milestone:** M5 — v1.0 Release · **Labels:** type: release, area: deployment, priority: critical, status: blocked, claude-ready · **Depends on:** 37 and explicit Vercel account authorization

Prepare version/changelog/release notes, verify environment and domain decisions, import repository into Vercel, validate preview, promote production, tag `v1.0.0`, create GitHub release, and run post-deploy smoke/rollback checks. **Accept:** all prior milestones closed and CI green; production build uses no invented credentials; owner explicitly authorizes deployment; canonical URL/metadata/social cards work; save/resume smoke passes; rollback documented; repository and Project updated to v1.0.
