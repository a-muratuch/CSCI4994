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

/** A real 2×2 PNG of one colour, so the browser can decode it. */
function png(red: number, green: number, blue: number) {
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
  const row = [0, red, green, blue, red, green, blue];
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([...row, ...row]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function login(page: Page, role: "customer" | "worker" | "admin") {
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

async function upload(page: Page, name: string, buffer: Buffer) {
  await page
    .getByLabel("Add a photo")
    .setInputFiles({ name, mimeType: "image/png", buffer });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
}

const loaded = (page: Page, name: string) =>
  expect
    .poll(() =>
      page
        .getByRole("img", { name })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(2);

test("customers and assigned crews add private move photos that administrators review", async ({
  page,
  request,
}) => {
  const customer = "10000000-0000-4000-8000-000000000001";
  const worker = "10000000-0000-4000-8000-000000000002";
  const admin = "10000000-0000-4000-8000-000000000003";
  const truck = "20000000-0000-4000-8000-000000000001";
  const requestId = randomUUID(),
    estimateId = randomUUID(),
    jobId = randomUUID();
  const day = new Date(`${process.env.REBEL_E2E_DATE!}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 10);
  const date = day.toISOString().slice(0, 10);
  // Backdated so it does not use the seed customer's request rate limit.
  localSql(`insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,created_at)
  values ('${requestId}','${customer}','5 Photo Lane','6 Photo Court','${date}','House','Studio','Photo fixture','None',now()-interval '1 day');`);

  // Customer: add a request photo; non-images are refused by their bytes.
  await login(page, "customer");
  await page.goto(`/customer/moves/${requestId}`);
  const photos = page.getByRole("region", { name: "Photos" });
  await expect(photos.getByText("Customer photos (0)")).toBeVisible();
  await upload(page, "not-a-photo.png", Buffer.from("<svg></svg>"));
  await expect(photos.getByRole("alert")).toHaveText(
    "Use a JPEG, PNG or WebP photo.",
  );
  await upload(page, "living-room.png", png(200, 40, 40));
  await expect(photos.getByText("Customer photos (1)")).toBeVisible();
  await loaded(page, "Customer photos photo 1");
  const photoSrc = await page
    .getByRole("img", { name: "Customer photos photo 1" })
    .getAttribute("src");
  const photoUrl = new URL(photoSrc!, page.url()).toString();
  const file = await page.request.get(photoUrl);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/png");
  expect(file.headers()["cache-control"]).toContain("no-store");

  // Cross-site uploads and signed-out reads are refused.
  const crossSite = await page.request.post("/api/photos", {
    headers: { Origin: "https://attacker.example" },
    multipart: { requestId, stage: "request" },
  });
  expect(crossSite.status()).toBe(403);
  expect((await request.get(photoUrl)).status()).toBe(404);

  // Remove and re-add while the request is still open.
  await photos
    .getByRole("button", { name: /Remove customer photos photo 1/ })
    .click();
  await expect(photos.getByText("Customer photos (0)")).toBeVisible();
  expect((await page.request.get(photoUrl)).status()).toBe(404);
  await upload(page, "sofa.png", png(40, 40, 200));
  await expect(photos.getByText("Customer photos (1)")).toBeVisible();

  // The worker is not assigned yet, so even a direct URL is unavailable.
  await login(page, "worker");
  const photoId = localSql(
    `select id from public.move_photos where request_id='${requestId}'`,
  ).trim();
  const requestPhoto = new URL(`/api/photos/${photoId}`, page.url()).toString();
  expect((await page.request.get(requestPhoto)).status()).toBe(404);

  // Schedule and start the job for the seed worker and truck.
  localSql(`begin;
insert into public.estimates(id,request_id,status,terms,created_by) values ('${estimateId}','${requestId}','draft','Photo terms','${admin}');
insert into public.estimate_items(estimate_id,position,label,amount_cents) values ('${estimateId}',1,'Photo move',50000);
update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=50000 where id='${estimateId}';
insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status)
  values ('${jobId}','${requestId}','${estimateId}','${date}','08:00','12:00','08:00','09:00','${truck}','in-progress');
insert into public.job_workers(job_id,worker_id) values ('${jobId}','${worker}');
commit;`);

  // Assigned worker: sees the customer's photo and adds condition photos.
  await page.goto(`/worker/jobs/${jobId}`);
  await expect(photos.getByText("Customer photos (1)")).toBeVisible();
  expect((await page.request.get(requestPhoto)).status()).toBe(200);
  await upload(page, "pickup.png", png(40, 160, 40));
  await expect(photos.getByText("Pickup condition (1)")).toBeVisible();
  await photos.getByRole("radio", { name: "Delivery condition" }).check();
  await upload(page, "delivery.png", png(160, 160, 40));
  await expect(photos.getByText("Delivery condition (1)")).toBeVisible();
  await loaded(page, "Delivery condition photo 1");
  // Workers cannot remove the customer's photo.
  await expect(
    photos.getByRole("button", { name: /Remove customer photos/ }),
  ).toHaveCount(0);

  // The customer's request is closed now, so no upload control remains.
  await login(page, "customer");
  await page.goto(`/customer/moves/${requestId}`);
  await expect(photos.getByText("Pickup condition (1)")).toBeVisible();
  await expect(page.getByLabel("Add a photo")).toHaveCount(0);

  // Administrator: every stage, read-only.
  await login(page, "admin");
  await page.goto(`/admin/jobs/${jobId}`);
  for (const heading of [
    "Customer photos (1)",
    "Pickup condition (1)",
    "Delivery condition (1)",
  ])
    await expect(photos.getByText(heading)).toBeVisible();
  await loaded(page, "Pickup condition photo 1");
  await expect(page.getByLabel("Add a photo")).toHaveCount(0);
  await page.goto(`/admin/requests/${requestId}`);
  await expect(photos.getByText("Delivery condition (1)")).toBeVisible();
});
