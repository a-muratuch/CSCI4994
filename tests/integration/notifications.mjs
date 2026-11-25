// Local Docker only. Both simultaneous sends roll back, leaving no messages/alerts.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const docker = existsSync(
  "/Applications/Docker.app/Contents/Resources/bin/docker",
)
  ? "/Applications/Docker.app/Contents/Resources/bin/docker"
  : "docker";
const args = [
  "exec",
  "-i",
  "supabase_db_csci4994",
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(input) {
  const result = spawnSync(docker, args, {
    input,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const customer = "10000000-0000-4000-8000-000000000001";
const admin = "10000000-0000-4000-8000-000000000003";
assert.equal(
  sql(
    `select count(*) from auth.users where (id='${customer}' and email='customer@example.invalid') or (id='${admin}' and email='admin@example.invalid')`,
  ),
  "2",
  "Disposable local seed required",
);
// Lazy conversation setup is the only retained local fixture, if not already present.
sql(
  `begin; select set_config('request.jwt.claims','{"sub":"${customer}","role":"authenticated"}',true); set local role authenticated; select (public.open_conversation('customer-support','${customer}')).id; commit;`,
);
const body = sql(
  "select pg_get_functiondef('rebel_move_private.limit_creations()'::regprocedure)",
);
const lock = body.includes("for no key update")
  ? "for no key update"
  : "for update";
const counts = () =>
  sql(
    "select json_build_array((select count(*) from public.messages),(select count(*) from public.notifications))",
  );
const before = counts();
function simultaneousSend(actor) {
  // Hold the same per-actor lock as the real quota trigger so both actors reach
  // notification creation together instead of relying on a lucky timing window.
  const input = `begin; set local statement_timeout='15s';
    select 1 from public.profiles where id='${actor}' ${lock};
    select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true);
    set local role authenticated; select pg_sleep(1);
    select (public.send_message((select id from public.conversations where kind='customer-support' and owner_id='${customer}'), 'Rollback-only simultaneous send',gen_random_uuid())).id;
    rollback;`;
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });
    let error = "";
    child.stdout.resume();
    child.stderr.on("data", (value) => {
      error += value;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(error || `SQL process exited ${code}`)),
    );
    child.stdin.end(input);
  });
}
const results = await Promise.allSettled([
  simultaneousSend(customer),
  simultaneousSend(admin),
]);
assert.equal(counts(), before, "Rollback-only sends changed saved records");
for (const result of results)
  assert.equal(result.status, "fulfilled", result.reason?.message);
assert.equal(lock, "for no key update", "Compatible per-actor lock required");
console.log(
  "Simultaneous customer/admin messages passed; message and notification counts unchanged.",
);
