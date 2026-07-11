import { NextRequest, NextResponse } from "next/server";
import {
  SITE_AUTH_COOKIE,
  SITE_AUTH_MAX_AGE_SECONDS,
  getExpectedAuthCookieValue,
  hashPasscode,
  safeEqual,
} from "@/lib/sitePasscode";

export async function POST(request: NextRequest) {
  const expected = getExpectedAuthCookieValue();
  if (!expected) {
    return NextResponse.json(
      { error: "SITE_PASSCODE is not configured on the server." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : "";
  if (!passcode) {
    return NextResponse.json({ error: "Enter the passcode." }, { status: 400 });
  }

  if (!safeEqual(hashPasscode(passcode), expected)) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_AUTH_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_AUTH_MAX_AGE_SECONDS,
  });
  return response;
}
