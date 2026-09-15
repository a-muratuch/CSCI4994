# Roadmap

The starter/tooling setup and design-system foundation at `/design-system` are implemented. Reduced-motion preference emulation remains a manual verification item. Guidance does not count as implementation of the planned pages below. Work in small tasks within each stage; update status when its exit criteria are actually met.

| Stage | Work | Exit criteria |
| --- | --- | --- |
| 0 — Foundation | Starter stack and project guidance | Shared scope, conventions, and checks documented; no backend added |
| 1 — Design system | Apply semantic colors, Geist wiring, component states, responsive examples | Buttons/forms/cards/badges look consistent and pass keyboard/contrast review |
| 2 — Public UI | Homepage and login/registration screens | Responsive navigation and forms; mocked actions are clearly identified |
| 3 — Customer UI | Overview, request form, moves, estimates, profile | Fictional request/estimate journey is demonstrable with empty/error states |
| 4 — Worker UI | Assigned jobs, schedule, availability, history | Assigned-job progress can be demonstrated with fixtures |
| 5 — Admin UI | Requests, estimates, jobs, customers, workers, trucks, assignments | Manual estimate and scheduling flow works as an explicitly mocked prototype |
| 6 — Backend foundation | Agree schema/state model; add Supabase Auth, migrations, roles, and RLS | Customer signup and trusted privileged-account provisioning work; role/ownership access tests pass before business data is exposed |
| 7 — Persistent workflow | Connect requests → estimates → acceptance → jobs → scheduling/assignments → progress | Full workflow persists; invalid transitions and conflicting assignments are handled; unauthorized access is denied |
| 8 — Capstone release | Regression/accessibility checks, deployment setup, demo data, documentation | Repeatable demo and production build work; environment setup and known limitations are documented |

Do not start Supabase while working on UI stages unless the project owner explicitly changes the sequence. RLS is part of the backend foundation, not a final cleanup task.

## After the MVP

Consider notifications, maps, payments, automatic estimates, PDFs, uploads, realtime, and analytics only after the core workflow succeeds. Reassess scope and dependencies before each addition.
