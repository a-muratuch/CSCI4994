# MoveFlow

MoveFlow is a CSCI 4994 capstone project: a moving-service operations platform for customers, workers, and administrators.

**Current state:** a fresh Next.js starter with TypeScript, Tailwind, shadcn/ui Nova, Lucide, Geist, and Motion. The homepage and metadata are still starter content. Authentication, dashboards, business workflows, and Supabase are planned, not implemented.

## Run locally

Use Node.js 20.9 or newer (the installed Next.js minimum) and npm. From the repository root:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Stop the server with Control+C. No Supabase account or environment variables are required for the current starter. Keep `package-lock.json`; use npm consistently.

## Checks

```bash
npm run lint
npm run build
```

There is no automated test runner configured yet. See [Development](docs/DEVELOPMENT.md) for checks appropriate to each change and known build requirements.

## Project guide

| File | Read it for |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Rules every coding agent should start with |
| [Project](docs/PROJECT.md) | Users, MVP workflow, scope, and non-goals |
| [Architecture](docs/ARCHITECTURE.md) | Current stack and future backend boundaries |
| [Development](docs/DEVELOPMENT.md) | Commands, conventions, verification, and Git |
| [AI workflow](docs/AI_WORKFLOW.md) | How to request and review a small AI coding task |
| [Design system](docs/DESIGN_SYSTEM.md) | Visual identity and accessible component behavior |
| [Roadmap](docs/ROADMAP.md) | Stages and completion criteria |
| [Decisions](docs/DECISIONS.md) | Important choices and unresolved questions |

**Next implementation step:** apply and verify the design system. Build one small feature at a time; add Supabase only in its planned stage.
