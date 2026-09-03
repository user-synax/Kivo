import { describe, expect, test } from "bun:test";
import {
  base32Decode,
  base32Encode,
  canonicalizeCode,
  generateBackupCodes,
  generateSecret,
  hotp,
  totpAt,
  verifyTotp,
} from "./totp.js";

// RFC 6238 Appendix B test vectors (SHA-1). The shared secret is the ASCII
// string "12345678901234567890" — the standard vectors use 8-digit codes.
const RFC_SECRET = "12345678901234567890"; // ASCII, NOT the base32 secret
const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const RFC_VECTORS = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("base32", () => {
  test("RFC 4648 round-trip", () => {
    expect(base32Encode(Buffer.from(RFC_SECRET, "ascii"))).toBe(RFC_SECRET_B32);
    expect(base32Decode(RFC_SECRET_B32).toString("ascii")).toBe(RFC_SECRET);
    expect(base32Decode("gezdgnbvgy3tqojqgezdgnbvgy3tqojq").toString("ascii")).toBe(RFC_SECRET);
  });

  test("ignores non-base32 characters (spaces, dashes, padding)", () => {
    expect(base32Decode(`${RFC_SECRET_B32}====`).toString("ascii")).toBe(RFC_SECRET);
  });
});

describe("HOTP / TOTP against RFC 6238 vectors", () => {
  test("matches all RFC 6238 8-digit vectors (HMAC-SHA1)", () => {
    for (const [time, expected] of RFC_VECTORS) {
      expect(totpAt(RFC_SECRET_B32, time * 1000, { digits: 8 })).toBe(expected);
    }
  });

  test("6-digit codes are a stable prefix behavior of the spec", () => {
    // 6-digit codes derive from the same dynamic-truncation value.
    expect(hotp(RFC_SECRET_B32, 0)).toBe("755224");
    expect(hotp(RFC_SECRET_B32, 1)).toBe("287082");
  });
});

describe("verifyTotp", () => {
  test("accepts the current code", () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, code, { timestampMs: now })).toBe(true);
  });

  test("accepts ±1 step of clock drift", () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = totpAt(secret, now + 30_000); // one step in the future
    expect(verifyTotp(secret, code, { timestampMs: now })).toBe(true);
    const past = totpAt(secret, now - 30_000);
    expect(verifyTotp(secret, past, { timestampMs: now })).toBe(true);
  });

  test("rejects wrong/malformed codes", () => {
    const secret = generateSecret();
    const now = Date.now();
    const other = generateSecret();
    expect(verifyTotp(secret, totpAt(other, now), { timestampMs: now })).toBe(false);
    expect(verifyTotp(secret, "000000", { timestampMs: now })).toBe(false);
    expect(verifyTotp(secret, "", { timestampMs: now })).toBe(false);
    expect(verifyTotp(secret, "12345", { timestampMs: now })).toBe(false);
    expect(verifyTotp(secret, "abcdef", { timestampMs: now })).toBe(false);
  });

  test("accepts whitespace-padded codes", () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, `  ${code}  `, { timestampMs: now })).toBe(true);
  });
});

describe("secrets & backup codes", () => {
  test("generated secrets are 32 base32 characters", () => {
    for (let i = 0; i < 20; i += 1) {
      const secret = generateSecret();
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(base32Decode(secret).length).toBe(20);
    }
  });

  test("backup codes are 10 base32 chars with a dash, unique", () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    }
    expect(new Set(codes).size).toBe(8);
  });

  test("canonicalizeCode normalizes case, dashes and spaces", () => {
    expect(canonicalizeCode(" abcd-efghij ")).toBe("ABCDEFGHIJ");
    expect(canonicalizeCode("abcdefghij")).toBe("ABCDEFGHIJ");
    expect(canonicalizeCode("123456")).toBe("123456");
  });
});
