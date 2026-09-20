import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyPinCookie } from "@/lib/pin-cookie";

function isLocalhostRequest(req: NextRequest): boolean {
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function middleware(req: NextRequest) {
  if (isLocalhostRequest(req)) {
    return NextResponse.next();
  }

  if (
    req.nextUrl.pathname.startsWith("/pin") ||
    req.nextUrl.pathname.startsWith("/api/verify-pin")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);
  const valid = cookie ? await verifyPinCookie(cookie.value) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/pin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
