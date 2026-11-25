import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const chat = "41000000-0000-4000-8000-000000000051";
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
for (const role of ["worker", "customer"] as const) {
  test(`${role} inbox switches All/Unread and marks only opened conversations read`, async ({
    page,
  }) => {
    localSql(readFileSync("tests/fixtures/message-presentation.sql"));
    const user =
      role === "worker"
        ? "10000000-0000-4000-8000-000000000002"
        : "10000000-0000-4000-8000-000000000001";
    localSql(`insert into public.conversation_reads(conversation_id,user_id,read_at)
      values('${chat}','${user}','1970-01-01')
      on conflict(conversation_id,user_id) do update set read_at=excluded.read_at;`);
    const unreadCount = () =>
      Number(
        localSql(`select count(*) from public.messages m
      where m.conversation_id='${chat}' and m.sender_id<>'${user}'
      and not exists(select 1 from public.conversation_reads r where r.conversation_id=m.conversation_id and r.user_id='${user}' and r.read_at>=m.created_at);`),
      );
    const before = unreadCount();
    expect(before).toBeGreaterThan(0);
    await page.goto(role === "worker" ? "/worker/login" : "/login");
    await page
      .getByLabel("Email address", { exact: true })
      .fill(`${role}@example.invalid`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Local-Test-Only-2026!");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(`/${role}`);
    const base = `/${role}/messages`;
    await page.goto(base);
    const filters = page.getByRole("navigation", { name: "Message filters" });
    const row = page.getByRole("main").locator(`a[href='${base}/${chat}']`);
    await expect(
      filters.getByRole("link", { name: "All", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(row).toContainText(`${before} unread messages`);
    await filters.getByRole("link", { name: /^Unread/ }).click();
    await expect(page).toHaveURL(`${base}?group=unread`);
    await expect(row).toBeVisible();
    expect(unreadCount()).toBe(before);
    await page.setViewportSize({ width: 375, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("list", { name: "Message history" }),
    ).toBeVisible();
    await expect.poll(unreadCount).toBe(0);
    await page.goto(`${base}?group=unread`);
    await expect(row).toHaveCount(0);
    await filters.getByRole("link", { name: "All", exact: true }).click();
    await expect(row).toBeVisible();
    await expect(row).not.toHaveAttribute("aria-describedby", `unread-${chat}`);
  });
}
