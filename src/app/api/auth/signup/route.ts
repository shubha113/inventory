import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/firebase-admin";
import { setSessionCookie } from "@/lib/session";
import type { UserProfile } from "@/types";

// This is what actually lives in Firestore for each user — same as
// UserProfile, plus the password hash. We NEVER send passwordHash to the
// client; every response below strips it out before returning.
interface UserDoc extends UserProfile {
  passwordHash: string;
}

const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      password.length < 6
    ) {
      return NextResponse.json(
        { error: "invalid-input", message: "Please fill in all fields (password must be at least 6 characters)." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const usersRef = adminDb.collection("users");

    // Email uniqueness check.
    const existing = await usersRef.where("email", "==", normalizedEmail).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: "email-in-use", message: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }

    // The very first user in the whole system becomes an admin, so there's
    // always at least one account that can manage others.
    const countSnap = await usersRef.limit(1).get();
    const role: UserProfile["role"] = countSnap.empty ? "admin" : "staff";

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const docRef = usersRef.doc(); // auto-generated id, plays the role Firebase Auth's uid used to play

    const newUser: UserDoc = {
      uid: docRef.id,
      email: normalizedEmail,
      name: name.trim(),
      role,
      createdAt: Date.now(),
      passwordHash,
    };

    await docRef.set(newUser);
    await setSessionCookie({
      uid: newUser.uid,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });

    const { passwordHash: _omit, ...profile } = newUser;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json(
      { error: "server-error", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
