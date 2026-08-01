# Contributing

## Workflow

Use one branch and pull request per issue: `issue-N-short-name`. Do not work around an open dependency. Discuss scope changes in the issue before implementation.

Commits should be focused and imperative. Pull requests must link the issue, explain behavior and architecture impact, list verification, show UI screenshots where relevant, and identify save/content schema changes.

## Commands

| Command                 | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `npm run format`        | Auto-format all files                                         |
| `npm run format:check`  | Verify formatting (CI gate)                                   |
| `npm run lint`          | ESLint (CI gate)                                              |
| `npm run typecheck`     | TypeScript strict check (CI gate)                             |
| `npm test`              | Vitest watch mode                                             |
| `npm test -- --run`     | Unit/component tests once (CI gate)                           |
| `npm run test:coverage` | Unit/component tests with lcov coverage (CI gate)             |
| `npm run test:e2e`      | Playwright smoke tests (CI gate, starts server automatically) |
| `npm run build`         | Production build (CI gate)                                    |
| `npm run dev`           | Local dev server                                              |

## Required checks

Formatting, lint, strict typecheck, unit/component tests, E2E smoke, and production build. Add coverage in proportion to user-facing risk. Never weaken a check simply to make CI pass.

## Code and content standards

- Pure rules in `game/core`; rendering in React.
- Validate external/save/content boundaries.
- Prefer explicit types and small named functions.
- Preserve seeded determinism.
- Meet WCAG 2.2 AA intent and support keyboard/touch.
- Do not add copied art, prose, names, or trade dress.
- Keep the geopolitical antagonist fictional and attack mechanics non-operational.

## Review

Reviewers check acceptance criteria, regressions, determinism, accessibility, performance, content safety, migrations, and documentation. Merge only after required checks and review. Squash merge is recommended.
