# Architecture

## Verified baseline

Read `package.json` and `package-lock.json` for dependencies; this snapshot describes the fresh setup.

| Area | Current choice |
| --- | --- |
| Framework | Next.js 16.3.5, App Router; React 19.2.8 |
| Language | TypeScript with strict checking |
| Styling | Tailwind CSS 4 through PostCSS; CSS theme variables in `app/globals.css` |
| Components | shadcn/ui `base-nova`, backed by Base UI; neutral base color |
| Icons/fonts | Lucide; Geist and Geist Mono through `next/font/google` |
| Animation | Motion installed; use only when an interaction benefits |
| Quality | ESLint 9 with Next.js core-web-vitals and TypeScript rules |
| Backend | Supabase planned; no SDK, schema, or authentication integration yet |

`components.json` is authoritative for shadcn generation. The installed primitives are button, card, input, label, and badge. Inspect their exports and Base UI composition before using them; do not assume Radix-specific APIs. `lib/utils.ts` currently re-exports `cn` from the installed `cn` package.

## Structure and boundaries

- `app/`: routes, layouts, route states, and global styling; no `src/` directory.
- `components/ui/`: existing shadcn primitives. Reuse before adding alternatives.
- `components/`: shared application components as needed.
- `lib/`: focused shared helpers; add domain modules only as actual tasks need them.
- `public/`: static assets. `@/*` resolves from the repository root.
- `docs/`: product and development guidance.

WeGo has public UI at `/`, `/login`, and `/register`, plus `/design-system`. The login and customer registration screens share `app/(auth)/auth-form.tsx` for local validation and password visibility. The route group shares a server-rendered layout without adding a URL segment. Authentication is not connected. `/customer`, `/worker`, and `/admin` remain planned; add folders incrementally rather than scaffolding future features.

Use Server Components by default. Add `"use client"` at the smallest interactive boundary for browser state, event handlers, or animation. Keep secrets and privileged operations on the server. Pass only serializable, necessary data to client components. Consult the installed Next.js guides in `node_modules/next/dist/docs/` before adopting version-sensitive APIs.

For the UI stage, use typed fictional fixtures separate from presentation when shared. Do not add a generic service framework or global state library before a concrete need appears.

## Planned Supabase stage

Supabase will provide Auth and PostgreSQL. Candidate entities are profiles, move requests, estimates, jobs, workers, trucks, and job-worker assignments; this is not an approved schema. Record relationships, ownership, constraints, and status transitions before writing migrations.

Planned flow: interface → validated server operation → Supabase with the caller's authenticated context → database constraints and row-level security (RLS). RLS limits which rows a user can read or modify.

- Customers access their own records; workers access assigned jobs and allowed personal records; admins manage company operations.
- Enforce permissions on reads and writes. Route redirects and hidden buttons are not authorization.
- Enable and test RLS as each table is introduced, before connecting it to user-facing data.
- Never expose service-role keys to the browser or use them as a shortcut around RLS.
- Validate inputs, role changes, assignments, and transitions server-side; use transactions where related writes must succeed together.
- Storage and realtime are deferred. Deployment provider is undecided.

See [Development](DEVELOPMENT.md) for conventions and [Decisions](DECISIONS.md) for changes to these boundaries.
