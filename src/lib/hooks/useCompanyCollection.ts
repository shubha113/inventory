"use client";

import { useMemo } from "react";
import { QueryConstraint, where } from "firebase/firestore";
import { useCollection } from "./useCollection";
import { useCompany } from "@/lib/company-context";

export function useCompanyCollection<T>(
  collectionName: string,
  orderByField = "createdAt",
  extraConstraints: QueryConstraint[] = []
) {
  const { activeCompanyId } = useCompany();

  const constraints = useMemo(
    () => (activeCompanyId ? [where("companyId", "==", activeCompanyId), ...extraConstraints] : []),
    [activeCompanyId, ...extraConstraints]
  );

  const result = useCollection<T>(collectionName, orderByField, constraints);

  if (!activeCompanyId) {
    return { data: [] as T[], loading: true, error: null };
  }

  return result;
}
