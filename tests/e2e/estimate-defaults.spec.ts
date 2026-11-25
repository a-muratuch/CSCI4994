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

test("new estimates start from the suggestion and standard text, and publish in one step", async ({
  page,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const requestId = randomUUID();
  const day = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 12);
  const date = day.toISOString().slice(0, 10);
  // Backdated so it does not use the seed customer's request rate limit.
  localSql(`begin;
insert into public.move_requests(id,customer_id,pickup,destination,pickup_address,destination_address,requested_date,property_type,move_size,items,access_details,created_at)
  values ('${requestId}','${customer}','7 Default Lane, Oxford, MS 38655','8 Default Court, Tupelo, MS 38801',
  '{"street":"7 Default Lane","city":"Oxford","state":"MS","zip":"38655"}','{"street":"8 Default Court","city":"Tupelo","state":"MS","zip":"38801"}',
  '${date}','House','Studio','Listed in inventory.','Pickup: None\nDestination: None',now()-interval '1 day');
insert into public.request_items(request_id,position,label,room,quantity,cubic_feet,weight_lb)
  values ('${requestId}',1,'Defaults fixture crate','Other',1,80,200);
commit;`);
  const original = localSql(
    "select row_to_json(s) from (select default_inclusions,default_exclusions,default_terms from public.pricing_settings) s",
  ).trim();
  try {
    // Administrator saves the standard text once.
    await login(page, "admin");
    await page.goto("/admin/inventory");
    const form = page.getByRole("form", { name: "Standard estimate text" });
    await form.getByLabel("Standard exclusions").fill("Storage\nPiano moving");
    await form.getByLabel("Standard terms").fill("Fixture standard terms.");
    await form.getByLabel("Standard inclusions").fill("");
    await form
      .getByRole("button", { name: "Save standard text", exact: true })
      .click();
    await expect(form.getByLabel("Standard inclusions")).toBeFocused();
    await form
      .getByLabel("Standard inclusions")
      .fill("Loading and unloading\nTruck and fuel");
    await form
      .getByRole("button", { name: "Save standard text", exact: true })
      .click();
    await expect(form.getByRole("status")).toHaveText(
      "Standard text saved. New estimate drafts start with it.",
    );

    // A new draft is already filled in.
    await page.goto(`/admin/requests/${requestId}/estimate`);
    await expect(page.getByLabel("Line 1 description")).toHaveValue(
      /^Moving crew: 2 movers/,
    );
    await expect(page.getByLabel("Line 2 description")).toHaveValue(/^Truck: /);
    await expect(page.getByLabel("Inclusions")).toHaveValue(
      "Loading and unloading\nTruck and fuel",
    );
    await expect(page.getByLabel("Exclusions")).toHaveValue(
      "Storage\nPiano moving",
    );
    await expect(page.getByLabel("Terms", { exact: true })).toHaveValue(
      "Fixture standard terms.",
    );

    // Invalid values never reach the confirmation; cancelling saves nothing.
    await page.getByLabel("Terms", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Save and publish", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Terms", { exact: true })).toBeFocused();
    await page.getByLabel("Terms", { exact: true }).fill("Fixture terms.");
    await page
      .getByRole("button", { name: "Save and publish", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Publish this estimate?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(
      localSql(
        `select count(*) from public.estimates where request_id='${requestId}'`,
      ).trim(),
    ).toBe("0");

    // Save and publish in one step.
    await page
      .getByRole("button", { name: "Save and publish", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Publish to customer", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/estimates\/[\da-f-]+$/);
    const estimateId = page.url().split("/").pop()!;
    await expect(
      page.getByText(
        "Awaiting the customer's decision. Admins cannot accept on the customer's behalf.",
      ),
    ).toBeVisible();

    // The customer can decide straight away.
    await login(page, "customer");
    await page.goto(`/customer/estimates/${estimateId}`);
    await expect(
      page.getByRole("button", { name: "Accept estimate", exact: true }),
    ).toBeVisible();
    // Inclusions sit in the collapsed "What's included" disclosure.
    await page.locator("summary", { hasText: "What's included" }).click();
    await expect(page.getByText("Piano moving", { exact: true })).toBeVisible();
  } finally {
    // Restore the shared local standard text for later runs.
    localSql(`update public.pricing_settings s set
  default_inclusions = array(select json_array_elements_text(o->'default_inclusions')),
  default_exclusions = array(select json_array_elements_text(o->'default_exclusions')),
  default_terms = o->>'default_terms'
  from (select '${original.replaceAll("'", "''")}'::json as o) v where s.id;`);
  }
});
