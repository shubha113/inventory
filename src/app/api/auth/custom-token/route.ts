import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminAuth } from "@/lib/firebase-admin";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Custom claims end up on request.auth.token in Firestore rules, so rules
  // can check role (e.g. request.auth.token.role == 'admin') without an
  // extra Firestore read.
  const customToken = await adminAuth.createCustomToken(session.uid, {
    role: session.role,
  });

  return NextResponse.json({ customToken });
}
