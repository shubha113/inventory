import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import type { UserProfile, CompanyRole } from "@/types";

// Adding someone to a company means writing a "companyMembers" doc for
// their uid. The browser can't do this itself for a *different* person,
// because finding that person's uid requires reading the "users"
// collection — and that collection is deliberately locked off from the
// client SDK entirely (see firestore.rules), so passwords can never leak.
// This route is the one trusted, server-side place allowed to bridge the
// two: it looks the invitee up by email using the Admin SDK, then writes
// their membership doc (also via the Admin SDK, which bypasses
// firestore.rules — that's fine here because THIS route enforces "only an
// existing admin of the company can invite" itself, in code, below).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id: companyId } = await params;
  const { email, role } = await req.json();

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "invalid-input", message: "Enter an email address." }, { status: 400 });
  }
  const memberRole: CompanyRole = role === "admin" ? "admin" : "staff";

  // Confirm the caller is actually an admin of THIS company before doing
  // anything else.
  const callerMemberDoc = await adminDb.collection("companyMembers").doc(`${companyId}_${session.uid}`).get();
  if (!callerMemberDoc.exists || callerMemberDoc.data()?.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only an admin of this company can invite people." },
      { status: 403 }
    );
  }

  const companyDoc = await adminDb.collection("companies").doc(companyId).get();
  if (!companyDoc.exists) {
    return NextResponse.json({ error: "not-found", message: "Company not found." }, { status: 404 });
  }
  const companyName = companyDoc.data()?.name ?? "";

  const normalizedEmail = email.trim().toLowerCase();
  const userSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
  if (userSnap.empty) {
    return NextResponse.json(
      {
        error: "user-not-found",
        message: "No StockFlow account with that email yet. Ask them to sign up first, then invite them.",
      },
      { status: 404 }
    );
  }
  const invitee = userSnap.docs[0].data() as UserProfile;

  const memberRef = adminDb.collection("companyMembers").doc(`${companyId}_${invitee.uid}`);
  const existing = await memberRef.get();
  if (existing.exists) {
    return NextResponse.json(
      { error: "already-member", message: `${invitee.name} is already part of this company.` },
      { status: 409 }
    );
  }

  await memberRef.set({
    companyId,
    companyName,
    uid: invitee.uid,
    name: invitee.name,
    email: invitee.email,
    role: memberRole,
    createdAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
