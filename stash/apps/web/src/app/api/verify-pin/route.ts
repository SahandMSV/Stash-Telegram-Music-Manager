import { NextRequest, NextResponse } from "next/server";
import { signPinCookie, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/pin-cookie";
import { isLockedOut, registerFailure, clearFailure } from "@/lib/pin-lockout";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (isLockedOut(ip)) {
    return NextResponse.json(
      { error: "locked out, try again shortly" },
      { status: 429 },
    );
  }

  const { pin } = (await req.json()) as { pin: string };
  const workerPort = process.env.WORKER_PORT ?? "4001";

  const workerRes = await fetch(
    `http://localhost:${workerPort}/internal/verify-pin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    },
  );
  const { valid } = (await workerRes.json()) as { valid: boolean };

  if (!valid) {
    registerFailure(ip);
    return NextResponse.json({ error: "invalid pin" }, { status: 401 });
  }

  clearFailure(ip);
  const token = await signPinCookie();
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
