import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, role: "admin" | "customer" | "worker") {
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
const destinations = [
  ["Overview", "/admin", null],
  ["Messages", "/admin/messages", null],
  ["Requests", "/admin/requests", "Operations"],
  ["Estimates", "/admin/estimates", "Operations"],
  ["Jobs & schedule", "/admin/jobs", "Operations"],
  ["Trucks", "/admin/trucks", "Operations"],
  ["Inventory & pricing", "/admin/inventory", "Operations"],
  ["Customers", "/admin/customers", "People"],
  ["Workers", "/admin/workers", "People"],
  ["Account access", "/admin/accounts", "People"],
  ["Analytics", "/admin/analytics", "Reports"],
  ["Activity log", "/admin/activity", "Reports"],
] as const;

test("administrator groups preserve routes, independent choices, deep links and history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "admin");
  const nav = page.locator("#workspace-sidebar").getByRole("navigation");
  const group = (name: string) =>
    nav.getByRole("button", { name, exact: true });
  await expect(group("Operations")).toBeEnabled();
  await expect(nav.locator(":scope > a").nth(0)).toHaveAttribute(
    "href",
    "/admin",
  );
  await expect(nav.locator(":scope > a").nth(1)).toHaveAttribute(
    "href",
    "/admin/messages",
  );
  await expect(group("Operations")).toHaveAttribute("aria-expanded", "true");
  await expect(group("People")).toHaveAttribute("aria-expanded", "false");
  await expect(group("Reports")).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Customers", exact: true }),
  ).toHaveCount(0);
  await group("Operations").focus();
  await expect(group("Operations")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    nav.getByRole("link", { name: "Requests", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(group("Operations")).toHaveAttribute("aria-expanded", "true");
  await group("People").focus();
  await page.keyboard.press("Space");
  await group("Reports").focus();
  await page.keyboard.press("Enter");
  await expect(group("People")).toHaveAttribute("aria-expanded", "true");
  await expect(group("Operations")).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link")).toHaveCount(12);
  await expect(page).toHaveURL(/\/admin$/);
  for (const [name, path, parent] of destinations) {
    if (
      parent &&
      (await group(parent).getAttribute("aria-expanded")) === "false"
    )
      await group(parent).click();
    const link = nav.getByRole("link", {
      name: name === "Messages" ? /^Messages/ : name,
      exact: name !== "Messages",
    });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    await expect(
      page
        .locator("#workspace-sidebar")
        .getByRole("button", { name: /^Notifications/ }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
  }
  await nav.getByRole("link", { name: "Customers", exact: true }).click();
  const detail = page
    .getByRole("main")
    .locator('a[href^="/admin/customers/"]')
    .first();
  await expect(detail).toBeVisible();
  const detailHref = await detail.getAttribute("href");
  await detail.click();
  await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
  await expect(
    nav.getByRole("link", { name: "Customers", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await group("People").click();
  await expect(
    nav.getByRole("link", { name: "Customers", exact: true }),
  ).toHaveCount(0);
  await expect(group("People")).toHaveClass(/font-semibold/);
  await nav.getByRole("link", { name: /^Messages/ }).click();
  await expect(page).toHaveURL(/\/admin\/messages$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
  await expect(group("People")).toHaveAttribute("aria-expanded", "true");
  await expect(group("Reports")).toHaveAttribute("aria-expanded", "true");
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/messages$/);
  await page.goBack();
  await group("Operations").click();
  await group("Reports").click();
  await page.reload();
  await expect(group("Operations")).toHaveAttribute("aria-expanded", "true");
  await expect(group("People")).toHaveAttribute("aria-expanded", "true");
  await expect(group("Reports")).toHaveAttribute("aria-expanded", "false");
  await page.goto("/admin/jobs/calendar");
  await expect(
    nav.getByRole("link", { name: "Jobs & schedule", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/admin/analytics");
  await expect(group("Reports")).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Analytics", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: "/tmp/rebel-admin-sidebar-desktop.png",
    fullPage: true,
  });
});

test("administrator group controls wait for hydration before keyboard interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "admin");
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/admin", { waitUntil: "commit" });
    const nav = page.locator("#workspace-sidebar").getByRole("navigation");
    const operations = nav.getByRole("button", {
      name: "Operations",
      exact: true,
    });
    for (const name of ["Operations", "People", "Reports"])
      await expect(
        nav.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    await expect(operations).toHaveAttribute("aria-expanded", "true");
    releaseScripts();
    await expect(operations).toBeEnabled();
    await operations.focus();
    await expect(operations).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(operations).toHaveAttribute("aria-expanded", "false");
    await expect(
      nav.getByRole("link", { name: "Requests", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(operations).toHaveAttribute("aria-expanded", "true");
    await expect(
      nav.getByRole("link", { name: "Requests", exact: true }),
    ).toBeVisible();
  } finally {
    releaseScripts();
    await page.unroute("**/_next/static/**/*.js");
  }
});

test("nested mobile navigation keeps focus, touch targets, reduced motion and other role menus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, "admin");
  const sidebar = page.locator("#workspace-sidebar");
  const nav = sidebar.getByRole("navigation");
  const menu = page.getByRole("button", {
    name: "Open administrator navigation",
    exact: true,
  });
  const group = (name: string) =>
    nav.getByRole("button", { name, exact: true });
  await menu.click();
  const close = sidebar.getByRole("button", {
    name: "Close navigation",
    exact: true,
  });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    sidebar.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await group("People").click();
  await expect(sidebar).toHaveAttribute("role", "dialog");
  await nav.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/customers$/);
  await expect(sidebar).not.toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await menu.click();
  await group("People").focus();
  await page.keyboard.press("Enter");
  await expect(group("People")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Tab");
  await expect(group("Reports")).toBeFocused();
  await page.keyboard.press("Enter");
  await nav.getByRole("link", { name: "Analytics", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(group("Reports")).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 768) await menu.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const target of await nav.locator("button, a").all()) {
      if (await target.isVisible())
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await group("Reports").evaluate((element) =>
        parseFloat(getComputedStyle(element).transitionDuration),
      ),
    ).toBeLessThanOrEqual(0.00001);
    if (width === 375) {
      await page.screenshot({
        path: "/tmp/rebel-admin-sidebar-mobile.png",
        fullPage: true,
      });
      await page.keyboard.press("Escape");
    }
  }
  for (const role of ["customer", "worker"] as const) {
    await page.context().clearCookies();
    await login(page, role);
    await expect(nav.getByRole("button")).toHaveCount(0);
    await expect(nav.getByRole("link")).toHaveCount(
      role === "customer" ? 6 : 5,
    );
    await expect(nav.getByRole("link", { name: /^Messages/ })).toBeVisible();
  }
});
