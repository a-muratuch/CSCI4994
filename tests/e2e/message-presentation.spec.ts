import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, role: "customer" | "worker" | "admin") {
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

const chat = "41000000-0000-4000-8000-000000000051";
const history = (page: Page) =>
  page.getByRole("list", { name: "Message history" });
const message = (page: Page, text: string) =>
  history(page)
    .getByRole("listitem")
    .filter({ has: page.getByText(text, { exact: true }) });

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
  );
}

test("chat bubbles, named roles, composer states, live replies and closed team history", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  localSql(readFileSync("tests/fixtures/message-presentation.sql"));
  // Reproduce an old run whose canonical messages have fallen outside the latest 100.
  localSql(`update public.messages set created_at=now()-interval '31 days'
    where conversation_id='${chat}' and request_id in ('41000000-0000-4000-8000-000000000061','41000000-0000-4000-8000-000000000062','41000000-0000-4000-8000-000000000063','41000000-0000-4000-8000-000000000064');
    insert into public.messages(conversation_id,sender_id,body,request_id,created_at)
    select '${chat}','10000000-0000-4000-8000-000000000001','Prior local chat run '||n,
      ('41000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,now()
    from generate_series(1,105) runs(n)
    on conflict(sender_id,request_id) do update set created_at=excluded.created_at;`);
  const canonicalPosition = () =>
    Number(
      localSql(`select count(*)+1 from public.messages
    where conversation_id='${chat}' and created_at>(select created_at from public.messages
      where sender_id='10000000-0000-4000-8000-000000000002' and request_id='41000000-0000-4000-8000-000000000063');`).toString(),
    );
  expect(canonicalPosition()).toBeGreaterThan(100);
  localSql(readFileSync("tests/fixtures/message-presentation.sql"));
  expect(canonicalPosition()).toBeLessThanOrEqual(5);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, "customer");
  await page.goto(`/customer/messages/${chat}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Move-team conversation",
  );
  await expect(
    page.getByRole("link", { name: "Back to messages", exact: true }),
  ).toHaveAttribute("href", "/customer/messages");
  await expect(
    page.getByRole("link", { name: "Move details", exact: true }),
  ).toHaveAttribute(
    "href",
    "/customer/moves/41000000-0000-4000-8000-000000000021",
  );
  const own = message(
    page,
    "There are three steps at pickup.\nThe driveway will be clear.",
  );
  const incoming = message(
    page,
    "Please share access instructions with the team.",
  );
  await expect(own).toContainText(/\(you\) · Customer/);
  await expect(incoming).toContainText("Morgan Example · Administrator");
  await expect(history(page)).toContainText(
    "Alexandria Example with a long display name for wrapping checks · Worker",
  );
  await expect(own.locator("p").nth(1)).toHaveCSS("white-space", "pre-wrap");
  const colors = await own
    .locator("p")
    .nth(1)
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(el).color,
    }));
  const theme = await page.evaluate(() => {
    // Resolve tokens through a color property so percentages use the same serialization.
    const probe = document.createElement("span");
    document.body.append(probe);
    const resolved: Record<string, string> = {};
    for (const token of ["primary", "primary-foreground", "muted"]) {
      probe.style.backgroundColor = `var(--${token})`;
      resolved[token] = getComputedStyle(probe).backgroundColor;
    }
    probe.remove();
    return resolved;
  });
  expect(colors.background).toBe(theme.primary);
  expect(colors.text).toBe(theme["primary-foreground"]);
  await expect(incoming.locator("p").nth(1)).toHaveCSS(
    "background-color",
    theme.muted,
  );
  const replyField = page.getByLabel("Message", { exact: true });
  const sendButton = page.getByRole("button", {
    name: "Send message",
    exact: true,
  });
  await expect(replyField).toHaveAttribute("rows", "2");
  await expect(replyField).toHaveAttribute("placeholder", "Write a reply");
  const replyBounds = await replyField.boundingBox();
  const sendBounds = await sendButton.boundingBox();
  expect(sendBounds!.x).toBeGreaterThan(replyBounds!.x + replyBounds!.width);
  expect(
    Math.abs(
      sendBounds!.y + sendBounds!.height - replyBounds!.y - replyBounds!.height,
    ),
  ).toBeLessThan(2);
  await page.screenshot({
    path: "/tmp/rebel-chat-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  const mobileReply = await replyField.boundingBox();
  const mobileSend = await sendButton.boundingBox();
  expect(mobileSend!.y).toBeGreaterThanOrEqual(
    mobileReply!.y + mobileReply!.height,
  );
  expect(Math.abs(mobileReply!.width - mobileSend!.width)).toBeLessThan(2);

  await page.screenshot({ path: "/tmp/rebel-chat-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  const input = page.getByLabel("Message", { exact: true });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await input.focus();
  expect(await input.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(
    "none",
  );
  await page.keyboard.press("Tab");
  await expect(send).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#message-result")).toHaveText(
    "Enter a message of 1–2000 characters.",
  );
  await expect(page.locator("#message-result")).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("x".repeat(2001));
  await send.click();
  await expect(page.locator("#message-result")).toBeFocused();
  await expect(input).toHaveValue("x".repeat(2001));

  const adminContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const admin = await adminContext.newPage();
  const originalAdminName: string = JSON.parse(
    localSql(
      "select to_json(full_name) from public.profiles where id='10000000-0000-4000-8000-000000000003';",
    ).toString(),
  );
  try {
    localSql(
      "update public.profiles set full_name='   ' where id='10000000-0000-4000-8000-000000000003';",
    );
    await login(admin, "admin");
    await admin.goto(`/admin/messages/${chat}`);
    await expect(admin.getByText(/^Live updates connected/)).toBeAttached();
    await expect(page.getByText(/^Live updates connected/)).toBeAttached();
    const body =
      `Chat layout ${Date.now()}\nhttps://example.invalid/${"a".repeat(2000)}`.slice(
        0,
        2000,
      );
    await input.fill(body);
    await send.click();
    await expect(input).toBeDisabled();
    await expect(page.locator("#message-result")).toHaveText("Message sent.");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(message(admin, body)).toBeVisible();
    await expect(message(admin, body)).toHaveCount(1);
    const longBubble = message(page, body).locator("p").nth(1);
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const bounds = await longBubble.boundingBox();
      const listBounds = await history(page).boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(
        listBounds!.width * (width < 640 ? 0.85 : 0.75) + 1,
      );
      const ownBounds = await own.boundingBox();
      const ownBubble = await own.locator("p").nth(1).boundingBox();
      expect(
        Math.abs(
          ownBounds!.x + ownBounds!.width - ownBubble!.x - ownBubble!.width,
        ),
      ).toBeLessThan(2);
      await expect(incoming.locator("p").first()).toBeVisible();
    }
    await input.scrollIntoViewIfNeeded();
    expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: "/tmp/rebel-chat-long-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: "/tmp/rebel-chat-long-mobile.png",
      fullPage: true,
    });

    // Exercise a real server rejection without changing application permissions.
    localSql(`insert into public.messages(conversation_id,sender_id,body,request_id)
      select '${chat}','10000000-0000-4000-8000-000000000001','Local chat quota fixture',gen_random_uuid() from generate_series(1,30);`);
    try {
      await input.fill("Keep this unsent draft");
      await send.click();
      await expect(page.locator("#message-result")).toHaveText(
        "Too many messages. Wait a minute, then retry this message.",
      );
      await expect(page.locator("#message-result")).toBeFocused();
      await expect(input).toHaveValue("Keep this unsent draft");
    } finally {
      localSql(`update public.messages set created_at=now()-interval '2 days'
        where conversation_id='${chat}' and body='Local chat quota fixture';`);
    }

    const reply = `Administrator live reply ${Date.now()}`;
    await admin.getByLabel("Message", { exact: true }).fill(reply);
    await admin
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(message(page, reply)).toBeVisible();
    await expect(message(page, reply).locator("p").first()).toHaveText(
      "Administrator",
    );
    await expect(message(admin, reply).locator("p").first()).toHaveText(
      "You · Administrator",
    );
    await expect(history(page)).not.toContainText("10000000");
    await expect(history(admin)).not.toContainText("10000000");
    await page
      .getByText("Participants and earlier senders", { exact: true })
      .click();
    await expect(page.locator("details")).not.toContainText("10000000");
    await expect(
      page
        .locator("details")
        .getByRole("listitem")
        .filter({ hasText: /^Administrator$/ }),
    ).toHaveCount(1);
    await expect(input).toHaveValue("Keep this unsent draft");

    for (const role of ["customer", "worker", "admin"] as const) {
      await page.context().clearCookies();
      await login(page, role);
      await page.goto(`/${role}/messages/${chat}`);
      await expect(input).toBeVisible();
      if (role === "worker")
        await expect(
          message(page, "Thanks. We will bring equipment for the steps."),
        ).toContainText(/\(you\) · Worker/);
      for (const id of [
        "41000000-0000-4000-8000-000000000052",
        "41000000-0000-4000-8000-000000000053",
      ]) {
        await page.goto(`/${role}/messages/${id}`);
        await expect(
          page.getByText(
            "This conversation is closed because the move is completed or cancelled.",
            { exact: true },
          ),
        ).toBeVisible();
        await expect(input).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Open company support", exact: true }),
        ).toHaveAttribute("href", `/${role}/messages`);
        if (id.endsWith("53"))
          await expect(history(page)).toHaveText("No messages yet.");
        else
          await expect(history(page)).toContainText(
            "The move is complete. Thank you.",
          );
      }
    }
  } finally {
    localSql(
      `update public.profiles set full_name='${originalAdminName.replaceAll("'", "''")}' where id='10000000-0000-4000-8000-000000000003';`,
    );
    await adminContext.close();
  }
});
