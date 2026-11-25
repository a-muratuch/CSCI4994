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

async function login(page: Page, role: "customer" | "admin") {
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

test("administrators see one Needs action list and a To schedule list beside the calendar", async ({
  page,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const admin = "10000000-0000-4000-8000-000000000003";
  const acceptedRequest = randomUUID(),
    newRequest = randomUUID(),
    estimateId = randomUUID();
  const day = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 18);
  const date = day.toISOString().slice(0, 10);
  // Accepted two days ago with no job yet, plus a brand-new request.
  localSql(`begin;
insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,preferred_window,created_at) values
  ('${acceptedRequest}','${customer}','13 Queue Lane','14 Queue Court','${date}','House','Studio','Boxes','None','midday',now()-interval '3 days'),
  ('${newRequest}','${customer}','15 Queue Lane','16 Queue Court','${date}','House','Studio','Boxes','None',null,now()-interval '1 day');
insert into public.estimates(id,request_id,status,terms,created_by) values ('${estimateId}','${acceptedRequest}','draft','Queue terms','${admin}');
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimateId}',1,'Queue move',30000);
update public.estimates set status='accepted',published_at=now()-interval '2 days',decided_at=now()-interval '2 days',total_cents=30000 where id='${estimateId}';
insert into public.estimate_events(estimate_id,actor_id,previous_status,new_status,occurred_at)
  values ('${estimateId}','${customer}','awaiting','accepted',now()-interval '2 days');
commit;`);
  // The local database has no reference numbers, so the short id is shown.
  const reference = (id: string) => id.slice(0, 8);

  await login(page, "admin");
  await page.goto("/admin");
  const queue = page.getByRole("region", { name: "Needs action" });
  const accepted = queue
    .getByRole("listitem")
    .filter({ hasText: reference(acceptedRequest) });
  await expect(accepted).toContainText("Schedule the accepted move");
  await expect(accepted).toContainText("Overdue");
  await expect(accepted).toContainText("Accepted 2 days ago");
  await expect(accepted).toContainText("midday (11 a.m.–1 p.m.)");
  const fresh = queue
    .getByRole("listitem")
    .filter({ hasText: reference(newRequest) });
  await expect(fresh).toContainText("Prepare an estimate");
  await expect(queue.getByText(/\d+ to schedule/)).toBeVisible();
  await accepted.getByRole("link", { name: /^Schedule/ }).click();
  await expect(page).toHaveURL(`/admin/estimates/${estimateId}/schedule`);

  // The calendar lists the same move and jumps to its requested week.
  await page.goto("/admin/jobs/calendar");
  const tray = page
    .getByRole("listitem")
    .filter({ hasText: reference(acceptedRequest) });
  await expect(tray).toContainText("Waiting or moving soon");
  await tray.getByRole("link", { name: "Show requested week" }).click();
  await expect(page).toHaveURL(new RegExp(`week=${date}`));
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: reference(acceptedRequest) })
      .getByText("This week", { exact: true }),
  ).toBeVisible();
});
