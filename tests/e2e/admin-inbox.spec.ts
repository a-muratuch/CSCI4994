import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const chat = "41000000-0000-4000-8000-000000000051";
const admin = "10000000-0000-4000-8000-000000000003";
function localSql(input: string | Buffer) {
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
  )
    .toString()
    .trim();
}
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
test("administrator inbox filters, searches, shows read counts and opens team chats at desktop/mobile sizes", async ({
  page,
}) => {
  localSql(readFileSync("tests/fixtures/message-presentation.sql"));
  localSql(`insert into public.conversation_reads(conversation_id,user_id,read_at)
    values('${chat}','${admin}','1970-01-01')
    on conflict(conversation_id,user_id) do update set read_at=excluded.read_at;`);
  const unread = Number(
    localSql(`select count(*) from public.messages
    where conversation_id='${chat}' and sender_id<>'${admin}' and created_at>'1970-01-01';`),
  );
  await login(page, "admin");
  await page.goto("/admin/messages");
  const inbox = page.getByRole("region", { name: "Company conversations" });
  const filters = page.getByRole("navigation", { name: "Message filters" });
  await expect(
    filters.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const team = inbox.locator(`a[href='/admin/messages/${chat}']`);
  await expect(team).toContainText(`${unread} unread messages`);
  await expect(team).toContainText(
    "Please keep the entrance clear for larger furniture.",
  );
  await filters.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(team).toHaveCount(0);
  await expect(inbox).toContainText("Customer support");
  await filters.getByRole("button", { name: "Workers", exact: true }).click();
  await expect(inbox).toContainText("Worker support");
  await filters
    .getByRole("button", { name: "Team chats", exact: true })
    .click();
  await expect(team).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search conversations" });
  await search.fill("not-a-real-person-or-move");
  await expect(inbox).toContainText("No matching conversations");
  await inbox.getByRole("button", { name: "Show all conversations" }).click();
  await expect(search).toHaveValue("");
  await search.fill("41000000");
  await expect(team).toBeVisible();
  await search.fill("Alexandria");
  await expect(team).toBeVisible();
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(team).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const bounds = await team.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: `test-results/admin-inbox-${width}.png`,
      fullPage: true,
    });
  }
  await team.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/admin/messages/${chat}`);
  await expect(
    page.getByRole("list", { name: "Message history" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      localSql(`select count(*) from public.messages m
    where m.conversation_id='${chat}' and m.sender_id<>'${admin}'
    and not exists(select 1 from public.conversation_reads r where r.conversation_id=m.conversation_id and r.user_id='${admin}' and r.read_at>=m.created_at);`),
    )
    .toBe("0");
  await page.goto("/admin/messages?group=unread");
  await expect(team).toHaveCount(0);
});
test("customer and worker sessions cannot open the administrator inbox", async ({
  browser,
}) => {
  for (const role of ["customer", "worker"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, role);
    await page.goto("/admin/messages");
    await expect(page).toHaveURL(`/${role}`);
    await context.close();
  }
});
