import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/firebase-admin";
import { setSessionCookie } from "@/lib/session";
import type { UserProfile } from "@/types";

interface UserDoc extends UserProfile {
  passwordHash: string;
}

// Generic on purpose: we don't want to tell an attacker whether the email
// exists or the password was wrong — "invalid credentials" either way.
const INVALID_CREDENTIALS = {
  error: "invalid-credentials",
  message: "That email and password don't match our records.",
};

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const snap = await adminDb
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
    }

    const userDoc = snap.docs[0].data() as UserDoc;
    const passwordMatches = await bcrypt.compare(password, userDoc.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
    }

    await setSessionCookie({
      uid: userDoc.uid,
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role,
    });

    const { passwordHash: _omit, ...profile } = userDoc;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { error: "server-error", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
