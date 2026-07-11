import { createHash, timingSafeEqual } from "node:crypto";

export const SITE_AUTH_COOKIE = "site_auth";
export const SITE_AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // a year

// The cookie stores a hash of the passcode, never the passcode itself, so it's
// harmless if inspected in devtools -- and it self-invalidates if SITE_PASSCODE
// is ever changed, since the hash won't match anymore.
export function hashPasscode(passcode: string): string {
  return createHash("sha256").update(`${passcode}:site-auth-v1`).digest("hex");
}

// Null when SITE_PASSCODE isn't set -- callers should treat that as "locked
// out, misconfigured" rather than "any passcode works."
export function getExpectedAuthCookieValue(): string | null {
  const passcode = process.env.SITE_PASSCODE;
  return passcode ? hashPasscode(passcode) : null;
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
