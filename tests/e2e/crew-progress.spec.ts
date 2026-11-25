import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

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

async function login(page: Page, role: "customer" | "worker" | "admin") {
  await page.context().clearCookies();
  await page.goto(role === "customer" ? "/login" : `/${role}/login`);
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
    .fill(`${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-Test-Only-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}

test("crews mark on the way and arrived; completion needs a delivery photo unless an administrator waives it", async ({
  page,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const worker = "10000000-0000-4000-8000-000000000002";
  const admin = "10000000-0000-4000-8000-000000000003";
  const truck = "20000000-0000-4000-8000-000000000001";
  const requestId = randomUUID(),
    estimateId = randomUUID(),
    jobId = randomUUID();
  // A job today, so "On the way" is allowed (moving day only).
  const today = localSql(
    "select ((now() at time zone 'America/Chicago')::date)::text",
  ).trim();
  localSql(`begin;
insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,created_at)
  values ('${requestId}','${customer}','17 Crew Lane','18 Crew Court','${today}','House','Studio','Boxes','None',now()-interval '2 days');
insert into public.estimates(id,request_id,status,terms,created_by) values ('${estimateId}','${requestId}','draft','Crew terms','${admin}');
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimateId}',1,'Crew move',30000);
update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=30000 where id='${estimateId}';
insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
  values ('${jobId}','${requestId}','${estimateId}','${today}','20:00','22:00','20:00','21:00','${truck}');
insert into public.job_workers(job_id,worker_id) values ('${jobId}','${worker}');
commit;`);

  // Worker: on the way, then arrived.
  await login(page, "worker");
  await page.goto(`/worker/jobs/${jobId}`);
  await page
    .getByRole("button", { name: "Mark on the way", exact: true })
    .click();
  await expect(
    page.getByText(
      "Progress saved: On the way. The customer has been notified.",
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mark on the way", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("On the way · the customer was notified."),
  ).toBeVisible();

  // Customer: notified, and the move page says so.
  await login(page, "customer");
  await page.goto("/customer/notifications");
  await expect(
    page.getByRole("heading", { name: "Your crew is on the way" }).first(),
  ).toBeVisible();
  await page.goto(`/customer/moves/${requestId}`);
  await expect(page.getByText("Your crew is on the way.")).toBeVisible();

  await login(page, "worker");
  await page.goto(`/worker/jobs/${jobId}`);
  await page.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm progress", exact: true })
    .click();
  await expect(
    page.getByText("Progress saved: Arrived. The job is in progress."),
  ).toBeVisible();
  // No delivery photo yet: completion is blocked.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mark completed", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Add at least one delivery photo in Photos below/),
  ).toBeVisible();

  // Administrator waives the photo with a reason.
  await login(page, "admin");
  await page.goto(`/admin/jobs/${jobId}`);
  await page.getByLabel("Reason (optional)").fill("Phone camera broken");
  await page
    .getByRole("button", { name: "Waive delivery photo", exact: true })
    .click();
  await expect(
    page.getByText("Delivery photo waived. The crew can complete the job."),
  ).toBeVisible();

  // Worker completes.
  await login(page, "worker");
  await page.goto(`/worker/jobs/${jobId}`);
  await expect(
    page.getByText(
      "An administrator waived the delivery photo: Phone camera broken",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm progress", exact: true })
    .click();
  await expect(page.getByText("Progress saved: Completed.")).toBeVisible();

  // Customer saw the arrival too.
  await login(page, "customer");
  await page.goto("/customer/notifications");
  await expect(
    page.getByRole("heading", { name: "Your crew has arrived" }).first(),
  ).toBeVisible();
});
