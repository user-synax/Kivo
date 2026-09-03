import crypto from "node:crypto";

// RFC 6238 TOTP helpers (HMAC-SHA1, 6 digits, 30-second period) built on
// node:crypto only — no third-party dependency.
//
// Implementation notes:
//  - Secrets are random 20-byte (160-bit) values, Base32-encoded (RFC 4648).
//  - Verification allows ±1 time-step of clock skew between the client's
//    authenticator app and the server.
//  - Correctness is pinned to the RFC 6238 Appendix B test vectors in
//    totp.test.js — run with `bun test`.
//
// WARNING: do not change the algorithm/digits/period here without also
// updating existing enrolled users' expectations — Google Authenticator and
// friends generate codes for the parameters baked into the provisioning URI
// at enrollment time.

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ── Base32 (RFC 4648) ───────────────────────────────────────────────────────

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    // Left-pad the final group with zeros to a 5-bit boundary.
    out += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // already sanitized; defensive
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── Secret generation ───────────────────────────────────────────────────────

// 20 random bytes → 32 Base32 characters (160-bit secrets, per RFC 4226 rec).
export function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

// ── HOTP (RFC 4226) ─────────────────────────────────────────────────────────

export function hotp(secret, counter, { digits = 6 } = {}) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(Math.trunc(counter)));
  const hmac = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  const code = (binary % 10 ** digits).toString().padStart(digits, "0");
  return code;
}

// ── TOTP (RFC 6238) ─────────────────────────────────────────────────────────

// Code valid at `timestampMs` (defaults to now).
export function totpAt(secret, timestampMs = Date.now(), { period = 30, digits = 6 } = {}) {
  const counter = Math.floor(timestampMs / 1000 / period);
  return hotp(secret, counter, { digits });
}

// Verify a 6-digit code with `window` steps of tolerance on either side of the
// current time step. Accepts whitespace (e.g. pasted codes).
export function verifyTotp(secret, token, { window = 1, period = 30, timestampMs = Date.now() } = {}) {
  const clean = String(token || "").trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(timestampMs / 1000 / period);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i, { digits: 6 }) === clean) return true;
  }
  return false;
}

// ── Provisioning URI (otpauth://) ───────────────────────────────────────────

// Standard URI consumed by Google Authenticator / Authy / 1Password etc. when
// the QR code is scanned. `accountName` is usually the user's email.
export function buildProvisioningUri({ issuer = "Kivo", accountName, secret }) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

// ── Shared helpers for the auth module ──────────────────────────────────────

// "ABCDEFG-HIJKLM" backup codes: 10 Base32 chars split by a dash, so they are
// typable and unambiguous to read out loud.
export function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = base32Encode(crypto.randomBytes(6)); // 48 bits → 10 chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

// Canonicalize whatever the user typed: case-insensitive, dash/space-tolerant,
// so "abcd e-fghij" and "ABCDEFGHIJ" both match a stored "ABCDE-FGHIJ".
export function canonicalizeCode(code) {
  return String(code || "").replace(/[\s-]/g, "").toUpperCase();
}
