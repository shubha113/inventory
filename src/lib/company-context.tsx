"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
} from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { useAuth } from "./auth-context";
import { CompanyMember } from "@/types";

const ACTIVE_COMPANY_STORAGE_KEY = "activeCompanyId";

interface CompanyContextValue {
  companies: CompanyMember[];
  activeCompanyId: string | null;
  activeCompany: CompanyMember | null;
  loading: boolean;
  setActiveCompanyId: (companyId: string) => void;
  createCompany: (name: string) => Promise<string>;
  deleteCompany: (companyId: string) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setCompanies([]);
      setActiveCompanyIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) return;

      const q = query(
        collection(db, "companyMembers"),
        where("uid", "==", profile.uid)
      );

      const unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const memberships = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as CompanyMember))
            .sort((a, b) => a.companyName.localeCompare(b.companyName));
          setCompanies(memberships);
          setLoading(false);
        },
        (err) => {
          console.error("Couldn't load your companies:", err);
          setLoading(false);
        }
      );

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, [profile]);

  useEffect(() => {
    if (companies.length === 0) {
      setActiveCompanyIdState(null);
      return;
    }
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY)
        : null;
    const stillValid = stored && companies.some((c) => c.companyId === stored);
    setActiveCompanyIdState(stillValid ? stored : companies[0].companyId);
  }, [companies]);

  const setActiveCompanyId = useCallback((companyId: string) => {
    setActiveCompanyIdState(companyId);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId);
    }
  }, []);

const createCompany = useCallback(
  async (name: string) => {
    if (!profile) throw new Error("You must be signed in to create a company.");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Company name is required.");

    const companyRef = doc(collection(db, "companies"));
    const memberRef = doc(db, "companyMembers", `${companyRef.id}_${profile.uid}`);

    const batch = writeBatch(db);
    batch.set(companyRef, {
      name: trimmed,
      createdBy: profile.uid,
      createdAt: Date.now(),
    });
    batch.set(memberRef, {
      companyId: companyRef.id,
      companyName: trimmed,
      uid: profile.uid,
      name: profile.name,
      email: profile.email,
      role: "admin",
      createdAt: Date.now(),
    });
    await batch.commit();

    setActiveCompanyId(companyRef.id);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyRef.id);
    }

    return companyRef.id;
  },
  [profile, setActiveCompanyId]
);
  // Deletes the company itself and every membership record pointing at it,
  // so nobody (including you) can access it anymore. The company's business
  // data (categories, products, orders, etc.) is intentionally left in
  // Firestore rather than walked and deleted document-by-document from the
  // client — every read of it requires a companyMembers doc that no longer
  // exists, so it's already unreachable. A full cascade-delete would need a
  // server-side job if that's ever wanted.
  const deleteCompany = useCallback(
    async (companyId: string) => {
      if (!profile) throw new Error("You must be signed in.");

      const membersSnap = await getDocs(
        query(collection(db, "companyMembers"), where("companyId", "==", companyId))
      );

      const batch = writeBatch(db);
      membersSnap.forEach((memberDoc) => batch.delete(memberDoc.ref));
      batch.delete(doc(db, "companies", companyId));
      await batch.commit();

      if (activeCompanyId === companyId) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
        }
        setActiveCompanyIdState(null);
      }
    },
    [profile, activeCompanyId]
  );

  const activeCompany = useMemo(
    () => companies.find((c) => c.companyId === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompanyId,
        activeCompany,
        loading,
        setActiveCompanyId,
        createCompany,
        deleteCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside <CompanyProvider>");
  return ctx;
}