import { test, expect, type Page } from "@playwright/test";
const password = "Local-Test-Only-2026!";
async function login(
  page: Page,
  role: "admin" | "worker" | "customer",
  email = role + "@example.invalid",
) {
  await page.goto(role === "customer" ? "/login" : `/${role}/login`);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/" + role + "$"));
}
test("security headers, truck lifecycle, worker invitation and inactive account enforcement", async ({
  page,
  request,
  browser,
}) => {
  const response = await request.get("/login");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  await login(page, "admin");
  await page.goto("/admin/trucks");
  const name = "Security truck " + Date.now();
  const add = page.getByRole("form", { name: "Add truck", exact: true });
  await add.getByLabel("New truck name", { exact: true }).fill(name);
  await add.getByRole("button", { name: "Add truck", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const edit = page.getByRole("form", { name: "Edit " + name, exact: true });
  await edit.getByLabel("Truck name", { exact: true }).fill(name + " renamed");
  await edit.getByRole("button", { name: "Save truck", exact: true }).click();
  const renamed = page.getByRole("form", {
    name: "Edit " + name + " renamed",
    exact: true,
  });
  await expect(renamed).toBeVisible();
  await renamed.getByLabel("Active for scheduling", { exact: true }).uncheck();
  await renamed
    .getByRole("button", { name: "Save truck", exact: true })
    .click();
  await expect(
    renamed.getByLabel("Active for scheduling", { exact: true }),
  ).not.toBeChecked();
  await page.goto("/admin/accounts");
  const search = page.getByRole("searchbox", {
    name: "Search accounts",
    exact: true,
  });
  const roleFilter = page.getByLabel("Role", { exact: true });
  const statusFilter = page.getByLabel("Status", { exact: true });
  await roleFilter.selectOption("admin");
  const currentAccount = page
    .getByRole("row")
    .filter({ has: page.getByText("You", { exact: true }) });
  await expect(currentAccount).toBeVisible();
  await expect(
    currentAccount.getByRole("button", {
      name: "Deactivate access",
      exact: true,
    }),
  ).toHaveCount(0);
  await search.fill("missing-local-account-xyz");
  await expect(
    page.getByRole("heading", { name: "No matching accounts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all accounts", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(roleFilter).toHaveValue("all");
  const email = "worker-" + Date.now() + "@example.invalid",
    worker = "Invited worker " + Date.now();
  await page.getByLabel("Worker name", { exact: true }).fill(worker);
  await page.getByLabel("Worker email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send worker invitation", exact: true })
    .click();
  await expect(page.getByText(/Worker invitation sent/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: worker })).toBeVisible();
  let mailId = "";
  await expect(async () => {
    const inbox = await (
      await request.get("http://localhost:54324/api/v1/messages")
    ).json();
    const mail = inbox.messages.find(
      (m: { ID: string; To: { Address: string }[] }) =>
        m.To.some((to) => to.Address === email),
    );
    expect(mail).toBeTruthy();
    mailId = mail.ID;
  }).toPass({ timeout: 20000 });
  const mail = await (
    await request.get("http://localhost:54324/api/v1/message/" + mailId)
  ).json();
  const link = String(mail.HTML ?? mail.Text ?? "").match(
    /http:\/\/localhost:3100\/auth\/invite\?token_hash=[a-f0-9]+/i,
  )?.[0];
  expect(Boolean(link)).toBe(true);
  // Disposable local invitation only. Never print the verification URL.
  const workerContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const workerPage = await workerContext.newPage();
  await workerPage.goto(link!);
  await workerPage
    .getByRole("button", { name: "Continue to password setup", exact: true })
    .click();
  await expect(workerPage).toHaveURL(/\/reset-password$/);
  await workerPage.getByLabel("New password", { exact: true }).fill(password);
  await workerPage
    .getByLabel("Confirm new password", { exact: true })
    .fill(password);
  await workerPage
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(workerPage).toHaveURL(/\/worker\/login\?password=updated$/);
  await login(workerPage, "worker", email);
  // This invited worker has no assignments; deactivation leaves existing seeded work intact.
  await search.fill(worker);
  await roleFilter.selectOption("customer");
  await expect(page.getByRole("row").filter({ hasText: worker })).toHaveCount(
    0,
  );
  await roleFilter.selectOption("worker");
  await statusFilter.selectOption("active");
  const card = page.getByRole("row").filter({ hasText: worker });
  await card
    .getByRole("button", { name: "Deactivate access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Escape");
  await expect(
    card.getByRole("button", { name: "Deactivate access", exact: true }),
  ).toBeFocused();
  await card
    .getByRole("button", { name: "Deactivate access", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Account deactivated. Existing records remain.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(
    page.getByText("Account deactivated. Existing records remain.", {
      exact: true,
    }),
  ).toBeFocused();
  await workerPage.goto("/worker");
  await expect(workerPage).toHaveURL(/\/auth\/error\?reason=profile/);
  await statusFilter.selectOption("inactive");
  await card
    .getByRole("button", { name: "Restore access", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Account reactivated.", { exact: true }),
  ).toBeVisible();
  await expect(card).toHaveCount(0);
  await statusFilter.selectOption("active");
  await expect(card).toBeVisible();
  await workerPage.goto("/worker");
  await expect(
    workerPage.getByRole("heading", {
      name: "Your assigned jobs",
      exact: true,
    }),
  ).toBeVisible();
  await workerPage.goto("/admin/accounts");
  await expect(workerPage).toHaveURL(/\/worker$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("table")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: worker, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await workerContext.close();
});
