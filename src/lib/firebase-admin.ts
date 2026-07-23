import "server-only";

let firebaseAdminInstance: any = null;

function getFirebaseAdmin() {
  if (firebaseAdminInstance) return firebaseAdminInstance;

  // Dynamically load the root module at runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin");

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase Admin environment variables.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  firebaseAdminInstance = admin;
  return admin;
}

export const getAdminDb = () => getFirebaseAdmin().firestore();
export const getAdminAuth = () => getFirebaseAdmin().auth();