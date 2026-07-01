import { NextRequest, NextResponse } from "next/server";
import { signToken, timingSafeEqual, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password, rememberMe } = await req.json();

  const expected = process.env.AUTH_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "AUTH_PASSWORD non configuré" }, { status: 500 });
  }

  if (!timingSafeEqual(password ?? "", expected)) {
    await new Promise((r) => setTimeout(r, 400)); // anti-brute-force delay
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = await signToken({ sub: "admin" }, Boolean(rememberMe));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : undefined, // 30j ou session
  });
  return res;
}
