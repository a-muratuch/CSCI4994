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

test("long-distance moves span several days and keep the crew and truck until they are back", async ({
  page,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const admin = "10000000-0000-4000-8000-000000000003";
  const [farRequest, farEstimate, nearRequest, nearEstimate] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const start = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 20);
  const date = start.toISOString().slice(0, 10);
  const later = (days: number) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const fixture = (
    request: string,
    estimate: string,
    to: string,
    zip: string,
  ) => `
insert into public.move_requests(id,customer_id,pickup,destination,pickup_address,destination_address,requested_date,property_type,move_size,items,access_details,created_at)
  values ('${request}','${customer}','20 Far Lane, Oxford, MS 38655','${to}',
  '{"street":"20 Far Lane","city":"Oxford","state":"MS","zip":"38655"}','{"street":"1 Far Court","city":"Far","state":"FL","zip":"${zip}"}',
  '${date}','House','Studio','Boxes','None',now()-interval '1 day');
insert into public.estimates(id,request_id,status,terms,created_by) values ('${estimate}','${request}','draft','Far terms','${admin}');
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimate}',1,'Far move',90000);
update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=90000 where id='${estimate}';`;
  // Oxford → Miami (about 17 h of driving each way), and a local Oxford move.
  localSql(
    `begin;${fixture(farRequest, farEstimate, "1 Far Court, Miami, FL 33130", "33130")}${fixture(nearRequest, nearEstimate, "2 Near Court, Oxford, MS 38655", "38655")}commit;`,
  );

  await login(page, "admin");
  await page.goto(`/admin/estimates/${farEstimate}/schedule`);
  await expect(page.getByLabel("Confirmed date")).toHaveValue(date);
  await page
    .getByRole("button", { name: "Fill in from the request", exact: true })
    .click();
  await expect(page.getByText(/^Long-distance move: loads /)).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Multi-day move/ }),
  ).toBeChecked();
  // Driving at the pricing speed takes more than a day each way.
  const delivery = await page.getByLabel("Delivery date").inputValue();
  const back = await page.getByLabel("Crew and truck back on").inputValue();
  expect(delivery > date).toBe(true);
  expect(back > delivery).toBe(true);
  // Only one local worker exists (a crew of two is suggested), so choose by hand.
  await expect(page.getByText(/No full crew and truck are free/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Local Worker/ }).check();
  // Trucks are radio cards inside the "Assigned truck" group.
  await page
    .getByRole("group", { name: "Assigned truck" })
    .locator('input[value="20000000-0000-4000-8000-000000000001"]')
    .check();
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/jobs\/[\da-f-]+$/);
  const saved = localSql(
    `select end_date::text||'|'||return_date::text from public.jobs where request_id='${farRequest}'`,
  ).trim();
  expect(saved).toBe(`${delivery}|${back}`);

  // Phase 9B: the job page, the calendar and the customer show the trip.
  await expect(
    // "Scheduled work" is now the label above this value.
    page.getByText(/^Long-distance: starts /),
  ).toBeVisible();
  await page.goto(`/admin/jobs/calendar?week=${delivery}&view=trucks`);
  await expect(
    page.getByText(/^Long-distance · day \d+ of \d+ · Delivering/).first(),
  ).toBeVisible();
  await page.goto(`/admin/jobs/calendar?week=${back}&view=trucks`);
  await expect(page.getByText(/Driving back$/).first()).toBeVisible();
  await login(page, "customer");
  await page.goto(`/customer/moves/${farRequest}`);
  await expect(
    page.getByText(/^Long-distance move · delivery on /),
  ).toBeVisible();
  // Customers never see the return day.
  await expect(page.getByText(/back on|crew and truck back/i)).toHaveCount(0);
  await login(page, "admin");

  // During the return trip the crew and truck are away for other moves.
  await page.goto(`/admin/estimates/${nearEstimate}/schedule`);
  await page.getByLabel("Confirmed date").fill(back);
  await page.getByLabel("Work start (CT)").fill("09:00");
  await page.getByLabel("Work end (CT)").fill("11:00");
  // The reason is shown in the warning itself, without opening "Not suggested".
  await expect(
    page.getByText(`Local Worker: Away on another move until ${back}.`).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Other jobs that day:", { exact: false }).first(),
  ).toBeVisible();
  // The day after they are back, the same crew is offered again.
  await page.getByLabel("Confirmed date").fill(later(12));
  await expect(
    page.getByRole("heading", { name: "Suggested team" }),
  ).toBeVisible();
  await expect(page.getByText(/Away on another move/)).toHaveCount(0);
});
