import { test, expect } from "@playwright/test";
test("password recovery requires email proof, rejects mismatched confirmation and signs out after change", async ({
  page,
  request,
}) => {
  const original = "Local-Test-Only-2026!",
    changed = "Local-Test-Recovery-2026!";
  await page.goto("/reset-password");
  await expect(
    page.getByText("Reset link unavailable", { exact: true }),
  ).toBeVisible();
  await page.goto("/forgot-password");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByLabel("Email address", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  const before = await (
    await request.get("http://localhost:54324/api/v1/messages")
  ).json();
  const previous = new Set(before.messages.map((m: { ID: string }) => m.ID));
  await page
    .getByLabel("Email address", { exact: true })
    .fill("customer@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account matches/)).toBeVisible();
  let mailId = "";
  await expect(async () => {
    const inbox = await (
      await request.get("http://localhost:54324/api/v1/messages")
    ).json();
    const mail = inbox.messages.find(
      (m: { ID: string; To: { Address: string }[] }) =>
        !previous.has(m.ID) &&
        m.To.some((to) => to.Address === "customer@example.invalid"),
    );
    expect(mail).toBeTruthy();
    mailId = mail.ID;
  }).toPass({ timeout: 20000 });
  const mail = await (
    await request.get(`http://localhost:54324/api/v1/message/${mailId}`)
  ).json();
  const text = String(mail.Text ?? mail.HTML ?? "");
  const link = text
    .match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0]
    ?.replaceAll("&amp;", "&");
  expect(!!link).toBe(true);
  // Recovery link stays in the disposable local mailbox and this browser. Never log it.
  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(
    page.getByRole("heading", { name: "Set a new password" }),
  ).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("Mismatch");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(
    page.getByLabel("Confirm new password", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page.getByLabel("Confirm new password", { exact: true }).fill(changed);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?password=updated$/);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("customer@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(changed);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/customer$/);
  await page.goto("/customer/account");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("Wrong-Local-Password!");
  await page.getByLabel("New password", { exact: true }).fill(original);
  await page.getByLabel("Confirm new password", { exact: true }).fill(original);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/customer\/account$/);
  await page.getByLabel("Current password", { exact: true }).fill(changed);
  await page.getByLabel("New password", { exact: true }).fill(original);
  await page.getByLabel("Confirm new password", { exact: true }).fill(original);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?password=updated$/);
});
