# MoveFlow agent guidance

## Start here

MoveFlow is a moving-service capstone for customers, workers, and admins. The repository is currently a Next.js starter, not a completed product.

1. Inspect Git status/diffs, relevant code, and `package.json` before editing. Preserve existing user work.
2. Read [Project](docs/PROJECT.md) for scope and [Roadmap](docs/ROADMAP.md) for sequence. Treat planned behavior as unimplemented until verified.
3. Read [Architecture](docs/ARCHITECTURE.md) for boundaries, [Development](docs/DEVELOPMENT.md) for conventions/checks, and [Design system](docs/DESIGN_SYSTEM.md) for UI work.
4. Follow [AI workflow](docs/AI_WORKFLOW.md): one small task, no unrelated edits, no unnecessary dependencies, no secrets, and no unrequested commits or publishing.
5. Reuse the installed Next.js/TypeScript/Tailwind/shadcn Nova/Lucide/Geist/Motion stack. Keep code simple enough for a student to explain.
6. Do not add Supabase or application features ahead of the authorized task. When backend work starts, enforce authorization and RLS from the beginning.
7. Verify according to the change: docs require link/accuracy review and `git diff --check`; code requires lint/build and relevant behavior checks. Report failures and checks not run honestly.
8. Finish by explaining every created/modified file, why it changed, and the verification results. Record significant new choices in [Decisions](docs/DECISIONS.md).

The project owner’s explicit task defines scope; these files supply defaults. If docs disagree with the code, explain the mismatch and update the relevant source within scope rather than silently assuming either is correct. Keep tool-specific instructions as short pointers. Preserve the generated Next.js block below.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
