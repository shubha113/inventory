// Server-only Firebase Admin SDK setup.
//
// This is DIFFERENT from src/lib/firebase.ts (the client SDK). The Admin SDK
// authenticates with a service account and has full, unrestricted access to
// Firestore — it does not go through firestore.rules at all. That's exactly
// why we use it for the "users" collection: passwords and account creation
// must only ever be touched by trusted server code, never by a browser.
//
// NEVER import this file from a "use client" component or from anything in
// src/lib/firebase.ts. It will crash (and it should — the private key must
// never reach the browser bundle).
import "server-only";
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys in .env files usually have literal "\n" sequences instead
  // of real newlines — this puts the real newlines back.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local " +
        "(see .env.local.example)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminDb = getFirestore(getAdminApp());

// Used ONLY to mint short-lived Firebase Auth "custom tokens" — see
// src/app/api/auth/custom-token/route.ts for why. We still never use
// Firebase Auth's own email/password sign-in; this is purely a way to give
// the Firestore client SDK something real to check in security rules
// (request.auth != null) now that our actual login/signup is custom.
export const adminAuth = getAuth(getAdminApp());
