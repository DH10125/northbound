# Claude implementation brief

You are implementing **Northbound**, not redesigning it. The product source of truth is `docs/game-design.md`; technical boundaries are in `docs/architecture.md`; authored content rules are in `docs/content-system.md`; sequence and acceptance gates are in `docs/roadmap.md`.

## Before coding

- Select exactly one GitHub issue and confirm its dependencies are closed.
- Read every file named in that issue.
- Restate the acceptance criteria in the PR description.
- Prefer the smallest complete change that satisfies the issue.

## Non-negotiables

- TypeScript strict mode; no untyped content blobs.
- Simulation logic is pure, deterministic, seedable, and independent of React.
- Game content is data validated at build/test time.
- Save data is versioned and migratable.
- Mobile, keyboard, reduced-motion, and screen-reader states are first-class.
- No real-world political accusation, operational sabotage instruction, gore-forward content, or copied Oregon Trail text/art/UI.
- Combat is consequential and avoidable, never the dominant optimal loop.
- Do not silently change product scope. Record meaningful choices in an ADR.

## Definition of done

Acceptance criteria pass, tests cover new rules, lint/typecheck/build pass, UI changes include screenshots, docs and schema examples are updated, and the PR links its issue with `Closes #N`.
