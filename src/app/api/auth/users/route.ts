import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import type { UserProfile } from "@/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Anyone signed in can see the team list (matches the old firestore.rules
  // behavior of "any signed-in user can read"), but only admins can change
  // roles — enforced in the PATCH route below.
  const snap = await adminDb.collection("users").orderBy("createdAt", "desc").get();
  const users = snap.docs.map((d) => {
    const { passwordHash: _omit, ...rest } = d.data() as UserProfile & { passwordHash: string };
    return rest;
  });
  return NextResponse.json({ users });
}
