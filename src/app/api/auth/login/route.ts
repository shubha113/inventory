import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { setSessionCookie } from "@/lib/session";
import type { UserProfile } from "@/types";

export const runtime = "nodejs";

interface UserDoc extends UserProfile {
  passwordHash: string;
}

const INVALID_CREDENTIALS = {
  error: "invalid-credentials",
  message: "That email and password don't match our records.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 400 });
    }

    const { email, password } = body;

    if (!email.trim() || !password) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query Firestore
    const snap = await adminDb
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
    }

    const userDoc = snap.docs[0].data() as UserDoc;

    if (!userDoc.passwordHash) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
    }

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
      { message: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500 }
    );
  }
}