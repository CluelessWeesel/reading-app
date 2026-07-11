import { NextRequest, NextResponse } from "next/server";
import { SITE_AUTH_COOKIE, getExpectedAuthCookieValue, safeEqual } from "@/lib/sitePasscode";

const PUBLIC_PATHS = new Set(["/unlock", "/api/unlock"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const expected = getExpectedAuthCookieValue();
  const cookie = request.cookies.get(SITE_AUTH_COOKIE)?.value;

  if (expected && cookie && safeEqual(cookie, expected)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  const next = `${pathname}${request.nextUrl.search}`;
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
