import { test, expect, type Page } from "@playwright/test";
const password = "Local-Test-Only-2026!";
async function login(page: Page, role: "customer" | "admin") {
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  if (await signOut.isVisible()) {
    await signOut.click();
    await expect(page).toHaveURL("http://localhost:3100/");
  }
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
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`${role}@example.invalid`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
  await page.waitForLoadState("load");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

test("customer inventory becomes an administrator estimate suggestion with ZIP mileage", async ({
  page,
}) => {
  // Administrator: the seed truck has an 800 cu ft capacity; saving it again is safe.
  await login(page, "admin");
  await page.goto("/admin/inventory");
  await expect(
    page.getByRole("heading", { name: "Inventory & pricing", exact: true }),
  ).toBeVisible();
  const capacity = page.getByLabel("Local Truck capacity (cu ft)", {
    exact: true,
  });
  await expect(capacity).toBeEnabled();
  await capacity.fill("800");
  await page
    .getByRole("form", { name: "Capacity for Local Truck" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("Capacity saved.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Road factor").fill("3");
  await page.getByRole("button", { name: "Save pricing", exact: true }).click();
  await expect(
    page.getByText("Check each pricing value is within its range.", {
      exact: true,
    }),
  ).toBeVisible();

  // Customer: Oxford, MS → Tupelo, MS with a small inventory.
  await login(page, "customer");
  await page.goto("/customer/request");
  for (const [prefix, street, city, zip] of [
    ["Pickup", "70 Inventory Lane", "Oxford", "38655"],
    ["Destination", "80 Inventory Road", "Tupelo", "38801"],
  ]) {
    await page.getByLabel(`${prefix} street`).fill(street);
    await page.getByLabel(`${prefix} city`).fill(city);
    await page.getByLabel(`${prefix} state`).fill("MS");
    await page.getByLabel(`${prefix} ZIP`).fill(zip);
  }
  await page
    .getByLabel("Preferred move date")
    .fill(process.env.REBEL_E2E_DATE!);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Property type").selectOption("Apartment");
  await page.getByLabel("Move size").selectOption("Studio");
  // Items are optional because the inventory step lists them.
  await expect(page.getByLabel("Items to move (optional)")).toHaveValue("");
  await page.getByLabel("Pickup access").fill("Ground floor");
  await page.getByLabel("Destination access").fill("Second floor, elevator");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();

  const item = page.getByLabel("Item", { exact: true });
  await expect(item).toBeEnabled();
  await item.selectOption({ label: "Sofa, 3-seat (~50 cu ft)" });
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await item.selectOption({ label: "Box, medium (~3 cu ft)" });
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  // Adding the same catalog item again increases its quantity.
  await item.selectOption({ label: "Box, medium (~3 cu ft)" });
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByLabel("Quantity of Box, medium")).toHaveValue("12");
  await page.getByLabel("Quantity of Box, medium").fill("10");
  await page.getByText("Item not listed? Describe it", { exact: true }).click();
  await page.getByLabel("Item name").fill("Antique trunk");
  await page.getByLabel("Approximate size (cu ft)").fill("12");
  await page.getByLabel("Approximate weight (lb, optional)").fill("80");
  await page
    .getByRole("button", { name: "Add described item", exact: true })
    .click();
  await expect(page.getByText(/12\s*items · 92\s*cu ft/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("1 × Sofa, 3-seat", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("10 × Box, medium", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Listed in inventory.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/moves\/[\da-f-]+$/);
  const requestId = page.url().split("/").pop()!;
  // The customer's request page shows the saved inventory.
  const details = page.getByRole("main");
  await expect(details.getByText(/12\s*items · 92\s*cu ft/)).toBeVisible();
  await expect(
    details.getByText("1 × Antique trunk", { exact: true }),
  ).toBeVisible();

  // Editing starts from the saved inventory.
  await page.goto(`/customer/moves/${requestId}/edit`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Quantity of Antique trunk")).toHaveValue("1");
  await page.getByRole("button", { name: "Remove Antique trunk" }).click();
  await expect(page.getByText(/11\s*items · 80\s*cu ft/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Save request changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request saved", exact: true }),
  ).toBeVisible();

  // Administrator: inventory on the request and a priced suggestion.
  await login(page, "admin");
  await page.goto(`/admin/requests/${requestId}`);
  await expect(page.getByText(/11 items · 80 cu ft/)).toBeVisible();
  await page.goto(`/admin/requests/${requestId}/estimate`);
  const miles = page.getByLabel("One-way distance (miles)");
  await expect(miles).toBeEnabled();
  // Oxford 38655 → Tupelo 38801 is roughly 45–60 road miles.
  const estimated = Number(await miles.inputValue());
  expect(estimated).toBeGreaterThan(40);
  expect(estimated).toBeLessThan(70);
  // Override with an exact distance: 80 cu ft, crew of 2, 50 mi.
  // Work 80 / (40 × 2) = 1 h + 50 / 35 ≈ 1.43 h → 2.5 h billed.
  await miles.fill("50");
  await expect(
    page.getByText(/Local Truck \(800 cu ft\) is the smallest truck/),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Suggested total/ }),
  ).toContainText("$450.00");
  await page
    .getByRole("button", { name: "Use suggested lines", exact: true })
    .click();
  await expect(page.getByLabel("Line 1 description")).toHaveValue(
    "Moving crew: 2 movers × 2.5 h at $45/h",
  );
  await expect(page.getByLabel("Line 1 amount ($)")).toHaveValue("225.00");
  await expect(page.getByLabel("Line 2 description")).toHaveValue(
    "Truck: Local Truck",
  );
  await expect(page.getByLabel("Line 3 description")).toHaveValue(
    "Mileage: 50 mi at $2/mi",
  );
  await expect(page.getByLabel("Line 3 amount ($)")).toHaveValue("100.00");
  await page.getByLabel("Inclusions").fill("Crew of two and one truck");
  await page.getByLabel("Exclusions").fill("Packing supplies");
  await page
    .getByRole("button", { name: "Save draft & review", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/estimates\/[\da-f-]+$/);
  await expect(page.getByText("$450.00").first()).toBeVisible();

  // The inventory page and suggestion stay usable on a phone-sized screen.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/inventory");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
