"use client";

// Wraps the whole app. Any component can call useAuth() to find out who is
// logged in, and to call login / signup / logout.
//
// Unlike before, this no longer talks to Firebase Auth directly. Instead it
// calls our own API routes (src/app/api/auth/*), which are the only code
// allowed to read/write the "users" collection (via the Admin SDK) and the
// only code that can set the session cookie. The browser never sees a
// password hash, a Firestore write for "users", or anything auth-related
// besides these fetch calls.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { signInWithCustomToken, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserProfile } from "@/types";

interface AuthContextValue {
  // Kept as a separate field from `profile` for backwards compatibility with
  // the rest of the app (AppShell/page.tsx just check truthiness of `user`).
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Thrown on failed login/signup so the login page can show a friendly
// message. `code` mirrors the `error` field the API routes return.
export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseAuthResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AuthError(data.error ?? "unknown", data.message ?? "Something went wrong. Please try again.");
  }
  return data;
}

// Establishes a real Firebase Auth client session so Firestore security
// rules can check request.auth (see firestore.rules). This does NOT touch
// passwords — it just trades our own session cookie for a short-lived
// Firebase "custom token" and signs into the Firebase client SDK with it.
// Failure here isn't fatal to being "logged in" (our cookie is what pages
// and API routes actually check) but it does mean Firestore reads/writes
// from the browser will get permission-denied until it succeeds.
async function establishFirestoreSession() {
  try {
    const res = await fetch("/api/auth/custom-token", { cache: "no-store" });
    const data = await parseAuthResponse(res);
    await signInWithCustomToken(auth, data.customToken);
  } catch (err) {
    console.error("Couldn't establish a Firestore session:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await parseAuthResponse(res);
      setProfile(data.profile ?? null);
      if (data.profile) {
        await establishFirestoreSession();
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseAuthResponse(res);
    setProfile(data.profile);
    await establishFirestoreSession();
  }

  async function signup(name: string, email: string, password: string) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await parseAuthResponse(res);
    setProfile(data.profile);
    await establishFirestoreSession();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await firebaseSignOut(auth).catch(() => {});
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ user: profile, profile, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}