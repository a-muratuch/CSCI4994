# Decisions

A lightweight architecture decision record (ADR) captures a choice and its reason. Keep entries short. Accepted means the direction is chosen, not that every feature is implemented. Add a new entry to supersede a decision instead of silently rewriting its history.

## D001 — Keep the fresh frontend stack

- **Status:** Accepted; baseline inspected 2026-09-14.
- **Decision:** Next.js App Router, strict TypeScript, Tailwind 4, shadcn/ui Base Nova, Lucide, Geist, and Motion; npm with the existing lockfile; root `app/` layout.
- **Reason:** Continue the working setup with a small, consistent stack.
- **Consequence:** Reuse installed components and inspect version-specific APIs. Do not add Aceternity or another UI/state framework by default.

## D002 — Build UI before connecting Supabase

- **Status:** Accepted; backend implementation deferred.
- **Decision:** Build the design system and role-based interfaces with fictional data before adding Supabase Auth/PostgreSQL.
- **Reason:** Keep tasks understandable and settle workflows before persistence.
- **Consequence:** Clearly label mock behavior. Introduce server validation, role checks, and RLS together with backend data, not afterward.

## D003 — Neutral identity with semantic status colors

- **Status:** Accepted; foundation implemented at `/design-system`.
- **Decision:** Black/white/neutral gray, red brand accent and errors, green success, amber warning.
- **Reason:** Support a restrained, readable operations interface.
- **Consequence:** Use semantic theme tokens; keep neutral shadcn interaction accents separate from brand red. See [Design system](DESIGN_SYSTEM.md).

## D004 — One shared agent entry point

- **Status:** Accepted.
- **Decision:** Root `AGENTS.md` plus focused docs; a short Copilot adapter; preserve the existing `CLAUDE.md` import and generated Next.js guidance.
- **Reason:** Avoid conflicting copies of development rules.
- **Consequence:** No extra Cursor rules or custom skills yet. Cursor supports root AGENTS guidance; add scoped rules only if a real folder-specific need develops.
- **References:** [GitHub repository instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization), [Cursor rules](https://prod.cursor.com/docs/rules).

## D005 — Design-system foundation tokens

- **Status:** Accepted.
- **Decision:** Separate brand and destructive tokens, paired status surfaces in both themes, stronger input boundaries and opaque focus rings; preserve Nova variants and radius scale. Wire sans/heading utilities to the existing Geist Sans variable.
- **Reason:** Keep meaning consistent and controls readable without a new component library.
- **Consequence:** Reuse these semantic utilities for future pages. The preview is static, with 44px controls and reduced-motion safeguards; it does not implement application behavior.

## Open decisions

Finalize estimate revisions/cancellations, state transitions, scheduling constraints/time zone, schema and trusted admin provisioning before Stage 6. Select test tooling when real behavior needs coverage. Select a deployment provider during release planning. These are not permission to implement features ahead of the roadmap.

## Entry template

```text
## D00N — Short title
- Status: Proposed / Accepted / Superseded by D00N
- Date: YYYY-MM-DD
- Decision:
- Reason:
- Consequence:
```
