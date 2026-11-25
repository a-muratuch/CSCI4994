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

test("a proposed appointment is booked when the customer accepts, and customers see busy-day hints", async ({
  page,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const admin = "10000000-0000-4000-8000-000000000003";
  const truck = "20000000-0000-4000-8000-000000000001";
  const requestId = randomUUID(),
    estimateId = randomUUID();
  const day = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 16);
  const date = day.toISOString().slice(0, 10);
  // Backdated so it does not use the seed customer's request rate limit.
  localSql(`begin;
insert into public.move_requests(id,customer_id,pickup,destination,pickup_address,destination_address,requested_date,property_type,move_size,items,access_details,preferred_window,created_at)
  values ('${requestId}','${customer}','11 Book Lane, Oxford, MS 38655','12 Book Court, Oxford, MS 38655',
  '{"street":"11 Book Lane","city":"Oxford","state":"MS","zip":"38655"}','{"street":"12 Book Court","city":"Oxford","state":"MS","zip":"38655"}',
  '${date}','House','Studio','Boxes','Pickup: None\nDestination: None','morning',now()-interval '1 day');
insert into public.estimates(id,request_id,status,terms,created_by,inclusions,exclusions,request_revision) values ('${estimateId}','${requestId}','draft','Booking terms','${admin}','{Loading}','{Storage}',1);
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimateId}',1,'Booking move',42000);
commit;`);

  // Administrator proposes a time on the draft, then publishes.
  await login(page, "admin");
  await page.goto(`/admin/estimates/${estimateId}`);
  await expect(
    page.getByRole("heading", { name: "Proposed appointment (optional)" }),
  ).toBeVisible();
  await expect(page.getByLabel("Confirmed date")).toHaveValue(date);
  await page
    .getByRole("button", { name: "Fill in from the request", exact: true })
    .click();
  await expect(page.getByLabel("Work start (CT)")).toHaveValue("08:00");
  await expect(page.getByLabel("Arrival window end (CT)")).toHaveValue("10:00");
  // Only one local worker exists, so choose the crew and truck by hand.
  await page.getByRole("checkbox", { name: /Local Worker/ }).check();
  // Trucks are radio cards inside the "Assigned truck" group.
  await page
    .getByRole("group", { name: "Assigned truck" })
    .locator(`input[value="${truck}"]`)
    .check();
  await page
    .getByRole("button", { name: "Save proposed appointment", exact: true })
    .click();
  await expect(
    page.getByText(
      "Proposed appointment saved. Accepting the estimate books it if it is still free.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove proposal", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Make estimate available", exact: true })
    .click();
  await expect(
    page
      .getByRole("main")
      .getByText("Estimate published to the customer account.", {
        exact: true,
      }),
  ).toBeVisible();

  // Customer sees only the date and window, accepts, and the move is booked.
  await login(page, "customer");
  await page.goto(`/customer/estimates/${estimateId}`);
  await expect(
    page.getByText(/^Proposed: .*arrival 8:00–10:00 AM CT$/),
  ).toBeVisible();
  await expect(page.getByText("Local Worker")).toHaveCount(0);
  // With a proposal, the single accept button names the booking date.
  const bookingDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  await page
    .getByRole("button", { name: `Accept and book ${bookingDay}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(
    page.getByText(
      "Estimate accepted and your move is booked for the proposed time.",
    ),
  ).toBeVisible();
  expect(
    localSql(
      `select count(*) from public.jobs where request_id='${requestId}' and scheduled_date='${date}' and start_time='08:00' and status='scheduled'`,
    ).trim(),
  ).toBe("1");
  await page.goto(`/customer/moves/${requestId}`);
  await expect(page.getByText("Confirmed appointment")).toBeVisible();

  // Busy-day hints in the request form (the next 62 days): a status for the
  // chosen date only, never names or other jobs.
  const soon = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
  );
  soon.setDate(soon.getDate() + 7);
  const soonDate = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  await page.goto("/customer/request");
  await page.getByLabel("Preferred move date").fill(soonDate);
  await expect(
    page.getByText(
      /^(Crews are available that day\.|Only a few crews are left that day\.|That day looks fully booked\.)/,
    ),
  ).toBeVisible();
});
