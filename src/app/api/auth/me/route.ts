import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import type { UserProfile } from "@/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ profile: null });
  }

  // Re-read from Firestore rather than trusting the JWT's copy of
  // name/role — an admin may have changed someone's role from Settings
  // since the token was issued, and we want that to take effect without
  // waiting a week for the cookie to expire.
  const doc = await adminDb.collection("users").doc(session.uid).get();
  if (!doc.exists) {
    return NextResponse.json({ profile: null });
  }

  const { passwordHash: _omit, ...profile } = doc.data() as UserProfile & { passwordHash: string };
  return NextResponse.json({ profile });
}
