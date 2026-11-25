import { test, expect, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

/** A real 1×1 PNG, so the photo upload accepts it. */
function tinyPng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0, 30, 120, 60]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Disposable local seed credentials. The runner refuses hosted databases.
const password = "Local-Test-Only-2026!";
async function readyForLogin(page: Page) {
  // Exercise a real client interaction before filling controlled inputs.
  await expect(async () => {
    const input = page.getByLabel("Password", { exact: true });
    if ((await input.getAttribute("type")) === "password")
      await page
        .getByRole("button", { name: "Show password", exact: true })
        .click();
    await expect(input).toHaveAttribute("type", "text");
  }).toPass({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
}

test("full local workflow persists and mobile navigation supports keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/login");
  await readyForLogin(page);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("customer@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/customer$/);
  await page.goto("/customer/request");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Pickup street")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Pickup street").fill("10 Local Test Lane");
  await page.getByLabel("Destination street").fill("20 Local Test Road");
  await page.getByLabel("Pickup city").fill("Oxford");
  await page.getByLabel("Pickup state").fill("MS");
  await page.getByLabel("Pickup ZIP").fill("38655");
  await page.getByLabel("Destination city").fill("Tupelo");
  await page.getByLabel("Destination state").fill("MS");
  await page.getByLabel("Destination ZIP").fill("38801");
  const date = process.env.REBEL_E2E_DATE;
  if (!date)
    throw new Error(
      "Run through npm run test:e2e to choose an unoccupied local fixture date.",
    );
  await page.getByLabel("Preferred move date").fill(date);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Property type").selectOption("House");
  await page.getByLabel("Move size").selectOption("2 bedrooms");
  await page.getByLabel("Items to move").fill("Twelve boxes and a sofa");
  // Both addresses need an access answer.
  await page.getByLabel("Pickup access").fill("Ground floor, driveway access");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Destination access")).toBeFocused();
  await page.getByLabel("Destination access").fill("None");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  // The unsaved request survives a refresh in this tab.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Items to move")).toHaveValue(
    "Twelve boxes and a sofa",
  );
  await expect(page.getByLabel("Move size")).toHaveValue("2 bedrooms");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Skip the optional inventory step.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/moves\/[\da-f-]+$/);
  const requestId = page.url().split("/").pop()!;
  await page.reload();
  await expect(
    page
      .getByText("10 Local Test Lane, Oxford, MS 38655", { exact: true })
      .first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  const menu = page.getByRole("button", { name: "Open customer navigation" });
  await menu.click();
  await expect(
    page.getByRole("dialog", { name: "Customer navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await menu.click();
  await page.mouse.click(365, 400);
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole("link", { name: "Estimates", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/estimates$/);
  async function login(role: "customer" | "admin" | "worker") {
    await page.context().clearCookies();
    await page.goto(role === "customer" ? "/login" : `/${role}/login`);
    await readyForLogin(page);
    await page
      .getByLabel("Email address", { exact: true })
      .fill(`${role}@example.invalid`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
  }
  for (const width of [768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await login("admin");
  await page.goto(`/admin/requests/${requestId}/estimate`);
  await page.getByLabel("Line 1 description").fill("Moving labor and truck");
  await page.getByLabel("Line 1 amount ($)").fill("525.00");
  await page.getByLabel("Inclusions").fill("One truck and assigned crew");
  await page.getByLabel("Exclusions").fill("Packing supplies");
  await page
    .getByLabel("Terms", { exact: true })
    .fill("Local test terms. Acceptance does not confirm a date.");
  await page
    .getByRole("button", { name: "Save draft & review", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/estimates\/[\da-f-]+$/);
  const estimateId = page.url().split("/").pop()!;
  await page
    .getByRole("button", { name: "Make estimate available", exact: true })
    .click();
  await expect(
    page.getByText("Estimate published to the customer account.", {
      exact: true,
    }),
  ).toBeVisible();
  await login("customer");
  await page.goto(`/customer/estimates/${estimateId}`);
  await page
    .getByRole("button", { name: "Accept estimate", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept estimate", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Accepted", { exact: true }).first(),
  ).toBeVisible();
  await login("admin");
  await page.goto(`/admin/estimates/${estimateId}/schedule`);
  await page.getByLabel("Work start (CT)", { exact: true }).fill("09:00");
  await page.getByLabel("Work end (CT)", { exact: true }).fill("12:00");
  await page
    .getByLabel("Arrival window start (CT)", { exact: true })
    .fill("09:00");
  await page
    .getByLabel("Arrival window end (CT)", { exact: true })
    .fill("10:00");
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
  const jobId = page.url().split("/").pop()!;
  await login("worker");
  await page.goto(`/worker/jobs/${jobId}`);
  await expect(page.getByRole("link", { name: /Open .* in Maps/ })).toHaveCount(
    2,
  );
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  // Arrived starts the job; completing needs a delivery photo (Phase 8G).
  await page.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark completed", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Delivery condition" }).check();
  await page.getByLabel("Add a photo").setInputFiles({
    name: "delivered.png",
    mimeType: "image/png",
    buffer: tinyPng(),
  });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark completed", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Completed", { exact: true }).first(),
  ).toBeVisible();
  await login("customer");
  await page.goto(`/customer/moves/${requestId}`);
  await expect(
    page.getByText("Completed", { exact: true }).first(),
  ).toBeVisible();
});

test("staff accounts navigate only within their stored roles", async ({
  page,
}) => {
  for (const role of ["admin", "worker"] as const) {
    await page.context().clearCookies();
    await page.goto(`/${role}/login`);
    await readyForLogin(page);
    await page
      .getByLabel("Email address", { exact: true })
      .fill(`${role}@example.invalid`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    await page.goto("/customer");
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    await page.getByRole("link", { name: /^Messages/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}/messages`));
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3100/");
  }
});
