import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role: "admin" | "worker" | "customer") {
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
test("weekly resource calendar, navigation, keyboard, responsive layouts and role protection", async ({
  page,
  request,
}) => {
  const denied = await request.get("/admin/jobs/calendar", { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
  expect(denied.headers().location).toContain("/admin/login");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "admin");
  await page.goto("/admin/jobs");
  // The jobs agenda groups jobs by day; each item carries its job date.
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: /^View job / }) })
    .filter({ hasNot: page.getByText("Cancelled", { exact: true }) })
    .first();
  await expect(row).toBeVisible();
  const jobHref = await row
    .getByRole("link", { name: /^View job / })
    .getAttribute("href");
  const selectedDate = (await row.getAttribute("data-date"))!;
  await page.getByRole("link", { name: "Week calendar", exact: true }).click();
  await page
    .getByLabel("Show week containing", { exact: true })
    .fill(selectedDate);
  await page.getByRole("button", { name: "Show week", exact: true }).click();
  const grid = page.getByRole("region", {
    name: "Weekly schedule grid",
    exact: true,
  });
  await expect(grid).toBeVisible();
  const jobLink = page
    .getByRole("link", { name: /^View job / })
    .filter({ hasText: jobHref!.split("/").at(-1)!.slice(0, 8) })
    .first();
  await expect(jobLink).toBeVisible();
  const weekHeading = await page.locator("#calendar-week").innerText();
  await page
    .getByRole("navigation", { name: "Calendar lanes" })
    .getByRole("link", { name: "Trucks", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Calendar lanes" })
      .getByRole("link", { name: "Trucks", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#calendar-week")).toHaveText(weekHeading);
  await page.screenshot({
    path: "/tmp/rebel-calendar-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Previous week", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "This week", exact: true }),
  ).toBeFocused();
  expect(
    await page
      .getByRole("link", { name: "This week", exact: true })
      .evaluate((el) => getComputedStyle(el).boxShadow),
  ).not.toBe("none");
  await page.getByRole("link", { name: "Next week", exact: true }).click();
  await expect(page.locator("#calendar-week")).not.toHaveText(weekHeading);
  await page.getByRole("link", { name: "Previous week", exact: true }).click();
  await expect(page.locator("#calendar-week")).toHaveText(weekHeading);
  for (const width of [375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 1024) {
      await expect(grid).toBeHidden();
      await expect(
        page
          .getByRole("heading", { level: 2 })
          .filter({ has: page.locator("time") }),
      ).toHaveCount(7);
      if (width === 375)
        await page.screenshot({
          path: "/tmp/rebel-calendar-mobile.png",
          fullPage: true,
        });
    } else await expect(grid).toBeVisible();
  }
  await page
    .getByRole("link", { name: /^View job / })
    .filter({ hasText: jobHref!.split("/").at(-1)!.slice(0, 8) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(jobHref! + "$"));
  await page.goto("/admin/jobs/calendar?week=not-a-date");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Choose a valid date",
  );
  await page
    .getByLabel("Show week containing", { exact: true })
    .fill("2001-01-01");
  await page.getByRole("button", { name: "Show week", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No jobs this week", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "This week", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("link", { name: "Agenda", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/jobs$/);
  for (const role of ["worker", "customer"] as const) {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page, role);
    await page.goto("/admin/jobs/calendar");
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
  }
});
