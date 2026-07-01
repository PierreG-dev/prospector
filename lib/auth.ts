import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const COOKIE_NAME = "prospector_session";
const ALG = "HS256";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant dans .env.local");
  return new TextEncoder().encode(s);
}

export async function signToken(payload: JWTPayload, rememberMe: boolean) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "30d" : "8h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) {
    // still iterate to avoid timing leak on length
    let acc = 1;
    for (let i = 0; i < Math.max(ab.length, bb.length); i++) acc |= 0;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
