import { test, expect, type Page } from "@playwright/test";
const password = "Local-Test-Only-2026!";
async function login(page: Page, role: "customer" | "admin" | "worker") {
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
async function create(page: Page) {
  await page.goto("/customer/request");
  for (const prefix of ["Pickup", "Destination"]) {
    await page
      .getByLabel(`${prefix} street`)
      .fill(prefix === "Pickup" ? "40 Workflow Lane" : "50 Workflow Road");
    await page.getByLabel(`${prefix} city`).fill("Oxford");
    await page.getByLabel(`${prefix} state`).fill("MS");
    await page.getByLabel(`${prefix} ZIP`).fill("38655");
  }
  await page
    .getByLabel("Preferred move date")
    .fill(process.env.REBEL_E2E_DATE!);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Property type").selectOption("House");
  await page.getByLabel("Move size").selectOption("Studio");
  await page.getByLabel("Items to move").fill("Eight boxes");
  await page.getByLabel("Pickup access").fill("Ground floor");
  await page.getByLabel("Destination access").fill("Ground floor");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Skip the optional inventory step.
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/moves\/[\da-f-]+$/);
  return page.url().split("/").pop()!;
}
test("request edits and cancellation, responsive admin search, revised estimates and scheduled cancellation", async ({
  page,
}) => {
  await login(page, "customer");
  const first = await create(page);
  await page.getByRole("link", { name: "Edit request", exact: true }).click();
  await expect(page.getByLabel("Pickup street")).toHaveValue(
    "40 Workflow Lane",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Items to move").fill("Nine boxes");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Skip the optional inventory step.
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Save request changes", exact: true })
    .click();
  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Nine boxes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Cancel request", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Cancellation saved.", { exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("main").getByText("Request cancelled", { exact: true }),
  ).toBeVisible();
  const id = await create(page);
  await login(page, "admin");
  await page.goto("/admin/requests");
  await page.getByLabel("Search records").fill(id);
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /View request/ })).toHaveCount(1);
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`/admin/requests/${id}/estimate`);
  await page.getByRole("button", { name: "Save draft & review" }).click();
  await expect(page.getByLabel("Line 1 description")).toBeFocused();
  await expect(page.getByLabel("Line 1 amount ($)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Line 1 description").fill("Labor");
  await page.getByLabel("Line 1 amount ($)").fill("450");
  await page.getByLabel("Inclusions").fill("Labor");
  await expect(page.getByLabel("Line 1 amount ($)")).toHaveValue("450.00");
  await page.getByLabel("Exclusions").fill("Packing");
  await page.getByRole("button", { name: "Save draft & review" }).click();
  await expect(page).toHaveURL(/\/admin\/estimates\/[\da-f-]+$/);
  const old = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "Make estimate available" }).click();
  await expect(
    page
      .getByRole("main")
      .getByText("Estimate published to the customer account.", {
        exact: true,
      }),
  ).toBeVisible();
  await login(page, "customer");
  await page.goto(`/customer/estimates/${old}`);
  // Declining asks why, so the administrator knows what to revise.
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  const decline = page.getByRole("dialog", {
    name: "Request changes or decline?",
  });
  await decline
    .getByRole("button", { name: "Confirm decline", exact: true })
    .click();
  await expect(decline.getByRole("alert")).toHaveText("Choose a reason.");
  await decline.getByLabel("The price is too high").check();
  await decline
    .getByLabel("What should change? (optional)")
    .fill("Two movers would be enough.");
  await decline
    .getByRole("button", { name: "Send change request", exact: true })
    .click();
  await expect(
    page.getByText("Your reason: The price is too high", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request changes", exact: true }),
  ).toHaveCount(0);
  // The administrator is notified and opens the estimate from the alert.
  await login(page, "admin");
  await page.goto("/admin/notifications");
  const alert = page
    .getByRole("listitem")
    .filter({ hasText: "Customer requested estimate changes" })
    .first();
  await expect(alert).toContainText("Reason: the price is too high");
  await alert.getByRole("link", { name: /Open estimate/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/estimates/${old}`));
  await expect(
    page.getByText("Customer's reason: The price is too high"),
  ).toBeVisible();
  await expect(page.getByText("“Two movers would be enough.”")).toBeVisible();
  await page
    .getByRole("button", { name: "Create revised estimate", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Save draft & review" }).click();
  await expect(page).toHaveURL(/\/admin\/estimates\/[\da-f-]+$/);
  const next = page.url().split("/").pop()!;
  expect(next).not.toBe(old);
  await page.getByRole("button", { name: "Make estimate available" }).click();
  await expect(
    page
      .getByRole("main")
      .getByText("Estimate published to the customer account.", {
        exact: true,
      }),
  ).toBeVisible();
  await login(page, "customer");
  await page.goto(`/customer/estimates/${next}`);
  await page
    .getByRole("button", { name: "Accept estimate", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept estimate", exact: true }),
  ).toHaveCount(0);
  await login(page, "admin");
  await page.goto(`/admin/estimates/${next}/schedule`);
  // The journey test leaves this crew in Tupelo at 12:00; Oxford is about 2 h
  // away (Phase 7B travel rule), so 14:00 is the earliest feasible start.
  await page.getByLabel("Work start (CT)", { exact: true }).fill("14:00");
  await page.getByLabel("Work end (CT)", { exact: true }).fill("17:00");
  await page
    .getByLabel("Arrival window start (CT)", { exact: true })
    .fill("14:00");
  await page
    .getByLabel("Arrival window end (CT)", { exact: true })
    .fill("15:00");
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
  await page.getByRole("button", { name: "Cancel scheduled job" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Cancellation saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("main").getByText("Move cancelled", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/activity?kind=job&action=cancelled");
  await expect(
    page.getByRole("heading", { name: /Job .*cancelled/ }).first(),
  ).toBeVisible();
  await login(page, "customer");
  await page.goto(`/customer/moves/${id}`);
  await expect(
    page.getByRole("main").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /move-team chat/ }).click();
  await expect(
    page.getByRole("main").getByText(/conversation is closed/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toHaveCount(
    0,
  );
  await page.goto(`/customer/moves/${first}`);
  await expect(
    page.getByRole("link", { name: "Edit request", exact: true }),
  ).toHaveCount(0);
});
test("support sending keeps focus and accessible conversation list includes company support", async ({
  page,
}) => {
  await login(page, "customer");
  await page.goto("/customer/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  const open = page.getByRole("link", { name: "Open company support" });
  if (await open.count()) await open.click();
  else await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/customer\/messages\/[\da-f-]+$/);
  await page
    .getByLabel("Message", { exact: true })
    .fill("Local workflow messaging check");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("main").getByText("Message sent.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toBeFocused();
  await page.goto("/customer/messages");
  await expect(
    page.getByRole("link", { name: "Open company support" }),
  ).toBeVisible();
});
