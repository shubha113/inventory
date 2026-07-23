import "server-only";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  const { getApps, getApp, initializeApp, cert } = require("firebase-admin/app");

  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Check FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your environment variables."
    );
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return cachedApp!;
}

export const getAdminDb = (): Firestore => {
  const { getFirestore } = require("firebase-admin/firestore");
  return getFirestore(getAdminApp());
};

export const getAdminAuth = (): Auth => {
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(getAdminApp());
};