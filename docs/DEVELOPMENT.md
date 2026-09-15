# Development

## Commands

Run from the repository root with npm and Node.js 20.9 or newer. Dependencies are locked in `package-lock.json`.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the lockfile exactly on a fresh checkout |
| `npm run dev` | Start local development at http://localhost:3000 |
| `npm run lint` | Run the configured ESLint checks |
| `npm run build` | Compile and type-check a production build |
| `npm run start` | Serve an already successful production build |
| `npx tsc --noEmit` | Optional focused type check once Next route types have been generated |

The starter uses generated `LayoutProps`; a standalone type check on a fresh checkout may lack generated Next types. Use the build as the full baseline check. `next/font/google` can require network access to fetch Geist during a build. Report environment failures accurately; do not change fonts or configuration merely to hide them.

There is currently no `test`, `format`, or dedicated `typecheck` npm script, and no test runner or CI workflow. Do not claim those checks ran.

## Folder and naming conventions

Keep the existing root `app/` layout and `@/*` imports. Use Next.js reserved route filenames (`page.tsx`, `layout.tsx`, etc.). Use kebab-case for new component/helper filenames, PascalCase for React components and types, camelCase for functions and variables, and `useSomething` for hooks. Place shared UI primitives in `components/ui/`, application components in `components/`, and shared helpers in `lib/`. Create `hooks/` or feature subfolders only when needed.

Keep small route-only components near their route. Move code to shared folders when it is actually reused, rather than creating abstractions in advance.

## Coding standards

- Keep TypeScript strict; prefer explicit domain types and `unknown` plus narrowing over `any`.
- Follow the surrounding file's formatting. Avoid unrelated formatting churn or a new formatter dependency.
- Write small components and functions with clear names. Comment reasons and tricky constraints, not obvious syntax.
- Reuse shadcn primitives, semantic theme classes, Lucide, and the existing `cn` helper.
- Keep Server Components as the default; limit client boundaries to necessary interaction.
- Use semantic HTML, labels, keyboard access, visible focus, and meaningful error messages.
- Model loading, empty, error, and success states. Treat untrusted inputs as data and validate server-side once mutations exist.
- Avoid speculative abstractions, broad refactors, lint suppressions, and unexplained type assertions.

## Verification by change

| Change | Required evidence |
| --- | --- |
| Documentation only | Review accuracy against the repo, check relative links, run `git diff --check` |
| UI or application code | Lint and build; manually exercise changed behavior on narrow and wide screens, keyboard navigation, and relevant states |
| Business logic or bug fix | Above plus a focused regression/behavior test when test tooling is introduced; document manual reproduction until then |
| Future auth/database work | Positive and negative role/ownership tests, RLS checks, invalid inputs, and persistent workflow checks |

Choose test tooling in a dedicated task when the first real behavior needs it. Do not install a test framework for a docs-only change. Report exactly what passed, failed, or was not run. A successful build does not prove business behavior or access control.

## Git workflow

1. Inspect `git status --short` and existing diffs before editing. Preserve uncommitted work.
2. Prefer a focused branch such as `docs/project-guidance` or `feat/customer-request-form`.
3. Complete one small task and its checks; review the full diff and `git diff --check`.
4. Stage only the intended paths, then inspect `git diff --cached`.
5. When asked to commit, use a clear message such as `docs: document MoveFlow foundation`. Keep dependency manifests and lockfile changes together when applicable.
6. Push or merge only when requested or covered by the agreed workflow. Never force-push, reset, or discard someone else's work to clean up a task.

Keep secrets, `.env*`, build artifacts, and `node_modules` out of commits. Future environment setup documentation should list variable names and placeholders only; deliberately adjust the ignore rule if an `.env.example` is introduced.
