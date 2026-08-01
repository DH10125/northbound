# Northbound

> The grid is dead. The rivers are dying. Your family is 1,300 miles away.

Northbound is a single-player browser survival adventure about traveling from Pensacola, Florida, to a family farm near Butternut, Wisconsin after an AI-enabled infrastructure collapse. Travel by night, hide and recover by day, manage scarce supplies, companions, illness, stealth, transport, and consequences across a branching route toward home.

This repository is the source of truth for product, engineering, and content work. Start with [the game design](docs/game-design.md), [architecture](docs/architecture.md), [content system](docs/content-system.md), and [38-issue roadmap](docs/roadmap.md).

## Product principles

- Every run tells a different, coherent survival story.
- Avoidance, preparation, empathy, and trade are often better than combat.
- Information is imperfect; consequences are legible and persistent.
- The collapse is fictional. Real places ground the journey, not factual claims about real institutions.
- Original presentation and mechanics; this is not a visual or textual clone of any existing game.

## Planned stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- Zod-validated data-driven content
- Zustand state with versioned local persistence
- Vitest, Testing Library, Playwright
- Vercel deployment; no secrets required for the core game

## Development status

Planning scaffold. GitHub issues are deliberately sequential and self-contained so a coding agent can take one issue at a time. Issue 01 creates the application baseline.

## Working agreement for Claude

1. Read `CLAUDE.md` and the four documents in `docs/`.
2. Work only one numbered issue at a time unless dependencies explicitly permit parallel work.
3. Preserve deterministic seeded simulation and content/engine separation.
4. Add tests for rules and validation; include mobile and keyboard acceptance checks for UI work.
5. Do not introduce a database, account system, paid service, or external AI dependency without an approved architecture decision.
6. End each pull request with issue linkage, test evidence, screenshots for UI, and any content/schema migration notes.

## Local development

**Requirements:** Node.js 22 (see `.nvmrc`), npm 10+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Vercel imports the repository using the Next.js defaults. Core gameplay requires no environment variables.

## License

Copyright retained by the repository owner. Add an explicit license before accepting outside contributions.
