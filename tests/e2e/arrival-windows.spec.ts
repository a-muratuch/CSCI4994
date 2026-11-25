import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";

// Fictional fixtures go only to the fixed local Docker database.
function localSql(input: string) {
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
  ).toString();
}

/** A real 2×2 PNG of one colour. */
function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = [0, 90, 120, 200, 90, 120, 200];
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([...row, ...row]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function login(page: Page, role: "customer" | "admin") {
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
    .getByLabel("Email address", { exact: true })
    .fill(`${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-Test-Only-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}

test("customers prefer an arrival window and add photos after saving; administrators fill the schedule in one click", async ({
  page,
}) => {
  const day = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 14);
  const date = day.toISOString().slice(0, 10);

  // Customer: choose a window while requesting.
  await login(page, "customer");
  await page.goto("/customer/request");
  await page.getByLabel("Pickup street").fill("9 Window Lane");
  await page.getByLabel("Pickup city").fill("Oxford");
  await page.getByLabel("Pickup state").fill("MS");
  await page.getByLabel("Pickup ZIP").fill("38655");
  await page.getByLabel("Destination street").fill("10 Window Court");
  await page.getByLabel("Destination city").fill("Oxford");
  await page.getByLabel("Destination state").fill("MS");
  await page.getByLabel("Destination ZIP").fill("38655");
  await page.getByLabel("Preferred move date").fill(date);
  await page.getByLabel("Afternoon (2–4 p.m.)").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Property type").selectOption("Apartment");
  await page.getByLabel("Move size").selectOption("Studio");
  await page.getByLabel("Items to move").fill("Six boxes");
  await page.getByLabel("Pickup access").fill("None");
  await page.getByLabel("Destination access").fill("None");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Skip the optional inventory step.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Afternoon (2–4 p.m.)", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request saved", exact: true }),
  ).toBeVisible();

  // Photos can be added straight away on the saved screen.
  const photos = page.getByRole("region", { name: "Photos" });
  await expect(photos.getByText("Customer photos (0)")).toBeVisible();
  await page
    .getByLabel("Add a photo")
    .setInputFiles({ name: "boxes.png", mimeType: "image/png", buffer: png() });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(photos.getByText("Customer photos (1)")).toBeVisible();

  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/moves\/[\da-f-]+$/);
  const requestId = page.url().split("/").pop()!;
  await expect(
    page.getByText("Preferred arrival: Afternoon (2–4 p.m.)"),
  ).toBeVisible();
  // Free this request's rate-limit slot for later journeys in the same run.
  localSql(
    `update public.move_requests set created_at=created_at-interval '11 minutes' where id='${requestId}';`,
  );

  // An accepted estimate, then one click fills the schedule.
  const estimateId = randomUUID();
  localSql(`begin;
insert into public.estimates(id,request_id,status,terms,created_by) values ('${estimateId}','${requestId}','draft','Window terms','10000000-0000-4000-8000-000000000003');
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimateId}',1,'Window move',30000);
update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=30000 where id='${estimateId}';
commit;`);
  await login(page, "admin");
  await page.goto(`/admin/requests/${requestId}`);
  await expect(page.getByText("Afternoon (2–4 p.m.)")).toBeVisible();
  await page.goto(`/admin/estimates/${estimateId}/schedule`);
  await expect(page.getByLabel("Confirmed date")).toHaveValue(date);
  await expect(
    page.getByText("The customer prefers afternoon (2–4 p.m.)."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fill in from the request", exact: true })
    .click();
  await expect(page.getByLabel("Work start (CT)")).toHaveValue("14:00");
  // No inventory listed, so the default four hours.
  await expect(page.getByLabel("Work end (CT)")).toHaveValue("18:00");
  await expect(page.getByLabel("Arrival window start (CT)")).toHaveValue(
    "14:00",
  );
  await expect(page.getByLabel("Arrival window end (CT)")).toHaveValue("16:00");
  await expect(
    page.getByText(
      /^Filled from the request: afternoon \(2–4 p\.m\.\), until 18:00\./,
    ),
  ).toBeVisible();
});
