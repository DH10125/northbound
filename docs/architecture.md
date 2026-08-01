# Architecture

## Goals

Deterministic simulation, typed data-driven content, resumable local play, accessibility, fast static-first delivery on Vercel, and clean seams for testing.

## Shape

```text
app/                 Next.js routes and layouts
components/          presentational UI and accessible primitives
features/            screens/use-case orchestration
game/core/           pure simulation, RNG, reducers, selectors
game/schemas/        Zod schemas and inferred types
game/content/        authored JSON/TS data by domain/chapter
game/persistence/    save envelope, migrations, import/export
game/testing/        fixtures and deterministic builders
public/              original static assets
```

React renders state and dispatches commands; it does not calculate game rules. `game/core` accepts state + command + RNG and returns next state + domain events. No wall-clock, network, browser global, or UI dependency enters the core.

## State model

`GameState` contains metadata/schema version/seed, clock and phase, player/party, inventory/storage, transport, route/location, world/weather, factions, flags/cooldowns, pursuit, farm state, event history, settings, and run status. Normalize authored IDs and refer by ID. Do not store derived values that selectors can calculate safely.

## Determinism

Use a small documented PRNG with serializable state. All random choices consume it through named helpers. A seed plus command sequence must reproduce the same run. Tests assert replay equivalence and weighted selection boundaries.

## Commands and domain events

Commands express player intent (`TRAVEL`, `REST`, `CHOOSE_EVENT_OPTION`). Validate preconditions before resolution. Domain events (`TIME_ADVANCED`, `ITEM_CONSUMED`, `CONDITION_PROGRESS`, `ENCOUNTER_STARTED`) make debugging and journey summaries possible.

## Persistence

LocalStorage is acceptable for autosave; IndexedDB may be adopted by ADR only if size requires it. Save envelope: schema version, app version, timestamp, checksum, and state. Keep three autosave slots plus manual export/import. Migrations are forward-only, pure, tested, and never mutate the input. Corrupt saves fail safely with recovery guidance.

## Content loading

Content is bundled and validated during tests/build. Stable string IDs follow `domain.region.slug`. References are checked for existence, graph reachability, option validity, and impossible conditions. Content changes do not alter engine code.

## UI and accessibility

Responsive layout with no hover-only information. Semantic controls, visible focus, keyboard operation, polite live regions for turn results, reduced motion, contrast, scalable type, captions/text alternatives, and non-color status indicators. Animations never gate input.

## Testing

- Unit: RNG, reducers, formulas, migrations, selectors.
- Property/invariant: resources never become NaN, invalid negative values, unreachable phase, or broken references.
- Content validation: schemas, IDs, graphs, chains, balance envelopes.
- Component: interactions and accessibility.
- End-to-end: create character, tutorial, save/resume, one full seeded journey, ending, mobile viewport.

CI gates: formatting, lint, typecheck, unit/content tests, production build; Playwright on protected integration points and release candidates.

## Security and privacy

No secrets in client code, no telemetry in v1.0, no untrusted HTML, and no runtime content download. Import files are size-limited and schema/checksum validated. Add dependencies conservatively and pin the lockfile. A security policy explains private vulnerability reporting once repository facilities allow it.

## Deployment

Vercel imports the repository and runs `npm run build`. Core gameplay requires no environment variables. Preview deployments belong to PRs. Production promotion occurs only after CI, smoke checks, and release acceptance. Do not deploy without account authorization.

## Architecture decisions

Significant deviations require `docs/adr/NNNN-title.md` with context, decision, alternatives, and consequences. Database, authentication, analytics, external AI, or network content all require an ADR and product approval.
