import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role: "customer" | "admin" | "worker") {
  await page.goto(role === "customer" ? "/login" : `/${role}/login`);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-Test-Only-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}
test("analytics periods, accessible charts, responsive layout and role protection", async ({
  page,
  request,
}) => {
  execFileSync(
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
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: readFileSync("tests/fixtures/analytics.sql"),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const denied = await request.get("/admin/analytics", { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
  await login(page, "admin");
  await page
    .locator("#workspace-sidebar")
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Analytics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Total accepted estimate value" }),
  ).toBeVisible();
  await expect(page.getByText(/not payments collected/)).toBeVisible();
  if ((await page.locator("details").getAttribute("open")) === null)
    await page.getByText("View weekly data", { exact: true }).click();
  await expect(
    page
      .getByRole("table", { name: "Weekly activity in Central Time" })
      .getByRole("row"),
  ).toHaveCount(9);
  await page.getByRole("link", { name: "4 weeks", exact: true }).click();
  await expect(page).toHaveURL(/weeks=4/);
  if ((await page.locator("details").getAttribute("open")) === null)
    await page.getByText("View weekly data", { exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(5);
  await page.getByRole("link", { name: "12 weeks", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "12 weeks", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if ((await page.locator("details").getAttribute("open")) === null)
    await page.getByText("View weekly data", { exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(13);
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByText("Alexandria Example with a long display name", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("View weekly data", { exact: true }).click();
  await page.screenshot({
    path: "/tmp/rebel-analytics-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "/tmp/rebel-analytics-mobile.png",
    fullPage: true,
  });
  await page.context().clearCookies();
  await login(page, "customer");
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/customer$/);
  await page.context().clearCookies();
  await login(page, "worker");
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/worker$/);
  const api = await page.request.get("/api/notifications");
  expect(api.headers()["cache-control"]).toContain("no-store");
});
test("live notifications, opening/read actions, keyboard controls and unsaved forms", async ({
  page,
  browser,
}) => {
  const customerContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const customer = await customerContext.newPage();
  try {
    await login(page, "admin");
    await page.goto("/admin/notifications");
    await expect(
      page.getByText("Live updates connected.", { exact: true }),
    ).toBeVisible();
    const markAll = page.getByRole("button", {
      name: "Mark all read",
      exact: true,
    });
    await expect(page.getByText("Loading notifications…")).toHaveCount(0);
    if (await markAll.isEnabled()) await markAll.click();
    await expect
      .poll(async () => {
        const r = await page.request.get("/api/notifications");
        return (await r.json()).snapshot.unread;
      })
      .toBe(0);
    await page.getByRole("link", { name: "Unread", exact: true }).click();
    await login(customer, "customer");
    await customer.goto("/customer/messages");
    await expect(
      customer.getByRole("heading", { name: "Messages", exact: true }),
    ).toBeVisible();
    const open = customer.getByRole("link", {
      name: "Open company support",
      exact: true,
    });
    if (await open.isVisible()) await open.click();
    else
      await customer
        .getByRole("button", { name: "Start conversation", exact: true })
        .click();
    await expect(customer).toHaveURL(/\/customer\/messages\/[\da-f-]+$/);
    const chat = customer.url().split("/").pop()!;
    const text = `Notification browser check ${Date.now()}`;
    await customer.getByLabel("Message", { exact: true }).fill(text);
    await customer
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      customer.getByText("Message sent.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "New customer message", exact: true }),
    ).toBeVisible();
    const bell = page.getByRole("button", {
      name: "Notifications, 1 unread",
      exact: true,
    });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(
      page.getByRole("button", { name: "Close notifications", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(bell).toBeFocused();
    await page
      .getByRole("main")
      .getByRole("link", { name: "Open conversation →", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/messages/${chat}\\?notification=`),
    );
    await expect(
      page
        .getByRole("list", { name: "Message history" })
        .getByText(text, { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const r = await page.request.get("/api/notifications");
        return (await r.json()).snapshot.unread;
      })
      .toBe(0);
    await customer.goto("/customer/account");
    const name = customer.getByLabel("Full name", { exact: true });
    await name.fill("Unsaved notification check");
    await page
      .getByLabel("Message", { exact: true })
      .fill("Reply for notification browser check");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      customer.getByRole("button", { name: /^Notifications, \d+ unread$/ }),
    ).toBeVisible();
    await expect(name).toHaveValue("Unsaved notification check");
    await customer
      .getByRole("button", { name: /^Notifications, \d+ unread$/ })
      .click();
    await expect(
      customer.getByRole("dialog", { name: "Notifications", exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("link", { name: "View all notifications →", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    await customer.setViewportSize({ width: 375, height: 900 });
    expect(
      await customer.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await customer.screenshot({
      path: "/tmp/rebel-notifications-mobile.png",
      fullPage: true,
    });
    await customer.setViewportSize({ width: 1280, height: 900 });
    await customer.screenshot({
      path: "/tmp/rebel-notifications-desktop.png",
      fullPage: true,
    });
    const beforeRead = (
      await (await customer.request.get("/api/notifications")).json()
    ).snapshot;
    const firstAlert = customer
      .getByRole("main")
      .locator("li")
      .filter({
        has: customer.locator(
          `a[href*="notification=${beforeRead.items[0].id}"]`,
        ),
      });
    await firstAlert.getByRole("button", { name: /^Mark as read/ }).click();
    await expect(
      customer
        .getByRole("status")
        .filter({ hasText: "Notifications marked as read." }),
    ).toBeFocused();
    await expect
      .poll(
        async () =>
          (await (await customer.request.get("/api/notifications")).json())
            .snapshot.unread,
      )
      .toBe(beforeRead.unread - 1);
    await expect(
      firstAlert.getByRole("button", { name: /^Mark as read/ }),
    ).toHaveCount(0);
    await page
      .getByLabel("Message", { exact: true })
      .fill("Second reply for mark-all verification");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
    let newestId = "";
    await expect
      .poll(async () => {
        const snapshot = (
          await (await customer.request.get("/api/notifications")).json()
        ).snapshot;
        newestId = snapshot.items[0].id;
        return snapshot.unread;
      })
      .toBe(beforeRead.unread);
    await expect(
      customer.getByRole("main").locator(`a[href*="notification=${newestId}"]`),
    ).toBeVisible();
    const action = customer.getByRole("button", {
      name: "Mark all read",
      exact: true,
    });
    await expect(action).toBeEnabled();
    await action.click();
    await expect
      .poll(async () => {
        const r = await customer.request.get("/api/notifications");
        return (await r.json()).snapshot.unread;
      })
      .toBe(0);
    await customer.getByRole("link", { name: "Unread", exact: true }).click();
    await expect(
      customer.getByRole("heading", {
        name: "You’re all caught up",
        exact: true,
      }),
    ).toBeVisible();
    await customer.context().setOffline(true);
    await page
      .getByLabel("Message", { exact: true })
      .fill("Reply while notification recipient was offline");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
    await customer.context().setOffline(false);
    await expect(
      customer.getByRole("heading", {
        name: "New company message",
        exact: true,
      }),
    ).toBeVisible();
    await expect(action).toBeEnabled();
    await action.click();
    await expect(
      customer.getByRole("heading", {
        name: "You’re all caught up",
        exact: true,
      }),
    ).toBeVisible();
    await customer.reload();
    await expect(
      customer.getByRole("heading", {
        name: "You’re all caught up",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await customerContext.close();
  }
});
