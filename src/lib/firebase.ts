// This file connects the app to YOUR Firebase project's Firestore, from the
// browser, plus a thin Firebase Auth client session used ONLY so Firestore
// security rules have something real to check (request.auth != null).
//
// We do NOT use Firebase Auth's email/password sign-in (that's the part we
// removed — see src/lib/firebase-admin.ts and src/app/api/auth/* for the
// actual login/signup, which is custom and backed by our own Firestore
// "users" collection). Instead, after a successful custom login, the app
// calls /api/auth/custom-token to get a short-lived Firebase "custom token"
// and signs into this Firebase Auth client with THAT — see
// src/lib/auth-context.tsx. This gives Firestore rules a real, unforgeable
// request.auth to check, closing the gap that a plain `allow write: if true`
// rule would leave open.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js re-runs this module on every hot-reload in dev mode.
// getApps().length check stops Firebase from being initialized twice.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
