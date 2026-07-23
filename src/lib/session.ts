// Handles the "who's logged in" session — on our own, without Firebase Auth.
//
// How it works:
// 1. After a successful login/signup, we sign a small JWT containing the
//    user's id/email/name/role, and store it in an httpOnly cookie.
// 2. httpOnly means client-side JavaScript can never read or steal this
//    cookie (protects against XSS). The browser just sends it back
//    automatically on every request.
// 3. On each request, middleware.ts and the /api/auth/me route verify the
//    JWT's signature using SESSION_SECRET. If it's missing, expired, or
//    tampered with, the user is treated as logged out.
//
// This uses `jose` (not `jsonwebtoken`) because jose works in the Edge
// runtime, which is what Next.js middleware runs on.
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";

const COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Generate one with " +
        "`openssl rand -base64 32` and put it in .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.uid === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        uid: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Sets the session cookie. Call this from a Route Handler after login/signup.
export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Reads + verifies the session cookie from within a Server Component,
// Route Handler, or Server Action.
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { COOKIE_NAME };
