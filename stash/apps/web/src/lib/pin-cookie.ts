import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "stash_pin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecretKey(): Uint8Array {
  const secret = process.env.PIN_COOKIE_SECRET;
  if (!secret) {
    throw new Error("PIN_COOKIE_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signPinCookie(): Promise<string> {
  return new SignJWT({ verified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyPinCookie(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.verified === true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
