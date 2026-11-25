import test from "node:test";
import assert from "node:assert/strict";
import {
  detectPhotoType,
  isPhotoStage,
  maxPhotoBytes,
  photoProblem,
  sameOrigin,
} from "./validation.ts";

const bytes = (...values) => new Uint8Array(values);

test("photo types come from file signatures, not names", () => {
  assert.equal(detectPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(
    detectPhotoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    "image/png",
  );
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  assert.equal(detectPhotoType(webp), "image/webp");
  // A RIFF file that is not WebP (for example WAV audio) is refused.
  assert.equal(
    detectPhotoType(new TextEncoder().encode("RIFF\0\0\0\0WAVE")),
    null,
  );
  assert.equal(detectPhotoType(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(detectPhotoType(new TextEncoder().encode("GIF89a")), null);
  assert.equal(detectPhotoType(bytes(0xff, 0xd8)), null);
  assert.equal(detectPhotoType(bytes()), null);
});

test("size and type problems give clear messages", () => {
  assert.equal(photoProblem(1000, "image/png"), null);
  assert.equal(photoProblem(maxPhotoBytes, "image/jpeg"), null);
  assert.match(photoProblem(maxPhotoBytes + 1, "image/jpeg"), /5 MB/);
  assert.match(photoProblem(0, null), /Choose a photo/);
  assert.match(photoProblem(1000, null), /JPEG, PNG or WebP/);
});

test("stages and origins are checked strictly", () => {
  assert.ok(isPhotoStage("pickup"));
  assert.ok(!isPhotoStage("Pickup"));
  assert.ok(!isPhotoStage(undefined));
  assert.ok(
    sameOrigin("http://localhost:3100", "http://localhost:3100/api/photos"),
  );
  assert.ok(
    !sameOrigin("https://evil.example", "http://localhost:3100/api/photos"),
  );
  assert.ok(!sameOrigin(null, "http://localhost:3100/api/photos"));
});
