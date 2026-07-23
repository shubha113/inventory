import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only admins can change roles." },
      { status: 403 }
    );
  }

  const { uid } = await params;
  if (uid === session.uid) {
    return NextResponse.json(
      { error: "forbidden", message: "You can't change your own role." },
      { status: 403 }
    );
  }

  const { role } = await req.json();
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "invalid-input", message: "Invalid role." }, { status: 400 });
  }

  await adminDb.collection("users").doc(uid).update({ role });
  return NextResponse.json({ ok: true });
}
