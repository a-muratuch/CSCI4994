import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const docker = existsSync(
  "/Applications/Docker.app/Contents/Resources/bin/docker",
)
  ? "/Applications/Docker.app/Contents/Resources/bin/docker"
  : "docker";
// Read only a date from the local fixture database; avoid collisions on repeat runs.
const date = spawnSync(
  docker,
  [
    "exec",
    "supabase_db_csci4994",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-At",
    "-c",
    "select (greatest(coalesce(max(coalesce(return_date, end_date, scheduled_date)), current_date), current_date + 30) + 1)::text from public.jobs",
  ],
  { encoding: "utf8" },
);
if (date.status !== 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date.stdout.trim()))
  throw new Error("Start the local seeded database before browser testing.");
// Previous fictional fixture requests must not consume a later run's rate window.
// Only the fixed local seed account is touched; no hosted connection is used.
const aged = spawnSync(
  docker,
  [
    "exec",
    "supabase_db_csci4994",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "update public.move_requests set created_at=least(created_at,now()-interval '11 minutes') where customer_id='10000000-0000-4000-8000-000000000001' and exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000001' and email='customer@example.invalid')",
  ],
  { encoding: "utf8" },
);
if (aged.status !== 0)
  throw new Error("Could not prepare local rate-limit fixtures.");
const result = spawnSync(
  "npx",
  ["playwright", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, REBEL_E2E_DATE: date.stdout.trim() },
  },
);
process.exit(result.status ?? 1);
