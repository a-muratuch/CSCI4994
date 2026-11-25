import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await expect(async () => {
    const input = page.getByLabel("Password", { exact: true });
    if ((await input.getAttribute("type")) === "password")
      await page
        .getByRole("button", { name: "Show password", exact: true })
        .click();
    await expect(input).toHaveAttribute("type", "text", { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page
    .getByLabel("Email address", { exact: true })
    .fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-Test-Only-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
// Fictional fixtures go only to the fixed local Docker database.
function localSql(input: string) {
  return execFileSync(
    existsSync("/Applications/Docker.app/Contents/Resources/bin/docker")
      ? "/Applications/Docker.app/Contents/Resources/bin/docker"
      : "docker",
    [
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
    ],
    { input, stdio: ["pipe", "pipe", "pipe"] },
  ).toString();
}
const customer = "10000000-0000-4000-8000-000000000001";
const worker = "10000000-0000-4000-8000-000000000002";
const admin = "10000000-0000-4000-8000-000000000003";
const truck = "20000000-0000-4000-8000-000000000001";
const address = (street: string, city: string, state: string, zip: string) =>
  JSON.stringify({ street, city, state, zip });
const oxford = (n: number) =>
  address(`${n} Travel Lane`, "Oxford", "MS", "38655");
const memphis = address("9 Travel Avenue", "Memphis", "TN", "38103");
const waterValley = address("7 Travel Road", "Water Valley", "MS", "38965");

/**
 * A pending request with an accepted estimate; optionally a job for the seed
 * worker and truck. Backdated so it does not use the seed customer's
 * ten-minute request limit that later browser tests rely on.
 */
function move(
  date: string,
  from: string,
  to: string,
  job?: { id: string; start: string; end: string },
) {
  const request = randomUUID(),
    estimate = randomUUID();
  return `
insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,pickup_address,destination_address,created_at)
  values ('${request}','${customer}','${JSON.parse(from).street}','${JSON.parse(to).street}','${date}','House','Studio','Travel fixture','None','${from}','${to}',now()-interval '1 day');
insert into public.estimates(id,request_id,status,terms,created_by)
  values ('${estimate}','${request}','draft','Travel fixture terms','${admin}');
insert into public.estimate_items(estimate_id,position,label,amount_cents)
  values ('${estimate}',1,'Travel fixture move',50000);
update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=50000
  where id='${estimate}';
${
  job
    ? `insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
  values ('${job.id}','${request}','${estimate}','${date}','${job.start}','${job.end}','${job.start}','${job.start}'::time + interval '1 hour','${truck}');
insert into public.job_workers(job_id,worker_id) values ('${job.id}','${worker}');`
    : ""
}`;
}
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

test("crews that cannot travel from their previous job in time are not suggested or saved", async ({
  page,
}) => {
  // Later than any other browser test's fixture date, so no other jobs interfere.
  const day = plusDays(process.env.REBEL_E2E_DATE!, 5);
  const tightDay = plusDays(day, 1);
  const jobA = randomUUID(),
    tightFirst = randomUUID(),
    tightSecond = randomUUID();
  const second = move(day, oxford(2), waterValley);
  const estimateB = /values \('([0-9a-f-]{36})','[0-9a-f-]{36}','draft'/.exec(
    second,
  )![1];
  localSql(`begin;
${move(day, oxford(1), memphis, { id: jobA, start: "08:00", end: "12:00" })}
${second}
${move(tightDay, oxford(3), memphis, { id: tightFirst, start: "08:00", end: "12:00" })}
${move(tightDay, oxford(4), waterValley, { id: tightSecond, start: "12:30", end: "15:00" })}
commit;`);

  await login(page);
  await page.goto(`/admin/estimates/${estimateB}/schedule`);
  await page.getByLabel("Confirmed date").fill(day);
  await page.getByLabel("Work start (CT)").fill("13:00");
  await page.getByLabel("Work end (CT)").fill("16:00");
  // The arrival window follows the work start until it is edited.
  await expect(page.getByLabel("Arrival window start (CT)")).toHaveValue(
    "13:00",
  );
  await expect(page.getByLabel("Arrival window end (CT)")).toHaveValue("14:00");

  // Job A ends in Memphis at 12:00; Oxford is about 2 h 50 min away with turnaround.
  const suggestion = page.getByRole("region", { name: "Suggested team" });
  await expect(suggestion).toBeVisible();
  await suggestion.getByText(/^Not suggested/).click();
  await expect(
    suggestion
      .getByText(
        /Local Worker:.*Can't reach in time: needs about 2 h 50 min from Memphis 38103 \(job ends 12:00\) to Oxford 38655, only 1 h between jobs\. Earliest feasible start: 14:50\./,
      )
      .first(),
  ).toBeVisible();
  await expect(
    suggestion.getByText(/Local Truck:.*Can't reach in time/),
  ).toBeVisible();

  // Choosing that crew by hand shows the problem and is refused on save.
  await page.getByRole("checkbox", { name: /Local Worker/ }).check();
  // Trucks are radio cards inside the "Assigned truck" group.
  await page
    .getByRole("group", { name: "Assigned truck" })
    .locator(`input[value="${truck}"]`)
    .check();
  await expect(
    page.getByText("Earliest feasible start for this team: 14:50.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(page.locator("#schedule-error")).toContainText(
    "Local Worker: Can't reach in time",
  );
  await expect(page).toHaveURL(/\/schedule$/);

  // At 15:00 the same crew and truck can make it, and the suggestion offers them.
  await page.getByLabel("Work start (CT)").fill("15:00");
  await page.getByLabel("Work end (CT)").fill("17:00");
  await page.getByLabel("Arrival window start (CT)").fill("15:00");
  await page.getByLabel("Arrival window end (CT)").fill("16:00");
  // The live travel warning clears (the earlier save message stays until the next save).
  await expect(
    page
      .locator('[role="status"]')
      .getByText(/Earliest feasible start for this team/),
  ).toHaveCount(0);
  await expect(
    suggestion.getByText(/Previous job is about 2 h 50 min away/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/jobs\/[\da-f-]+$/);

  // Jobs saved before this rule (or by direct data entry) are flagged, not changed.
  await page.goto(`/admin/jobs/${tightSecond}`);
  await expect(page.getByText("Tight travel", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      /Local Truck: Can't reach in time: needs about 2 h 50 min from Memphis 38103/,
    ),
  ).toBeVisible();
  await page.goto(`/admin/jobs/calendar?week=${tightDay}&view=trucks`);
  await expect(
    page
      .getByText(
        /Tight travel: needs about 2 h 50 min from Memphis 38103 \(ends 12:00\), only 30 min before this job\./,
      )
      .first(),
  ).toBeVisible();
});
