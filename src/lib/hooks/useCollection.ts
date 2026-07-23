"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useCollection<T>(
  collectionName: string,
  orderByField = "createdAt",
  extraConstraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize extraConstraints so useEffect can safely track changes without infinite loops
  const constraintsKey = JSON.stringify(extraConstraints);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, collectionName),
        orderBy(orderByField, "desc"),
        ...extraConstraints
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() } as T)
          );
          setData(items);
          setLoading(false);
        },
        (err) => {
          console.error(`Error loading collection '${collectionName}':`, err);
          setError(err.message);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error(`Failed to construct query for '${collectionName}':`, err);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, orderByField, constraintsKey]);

  return { data, loading, error };
}