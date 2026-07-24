// Small generic helpers so every page doesn't have to re-write the same
// "add a document" / "update a document" / "delete a document" code.
//
// Firestore refuses to write ANY field whose value is `undefined` — it
// throws at write time (e.g. "Unsupported field value: undefined"). Our
// forms often produce `undefined` on purpose for optional fields (e.g. "no
// category selected"), so both helpers below sanitize the data first
// instead of making every page remember to do it.
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

function stripUndefined<T extends object>(data: T): Partial<T> {
  const clean: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      (clean as Record<string, unknown>)[key] = value;
    }
  }
  return clean;
}

// For an existing document, `undefined` usually means "the user just
// cleared this field" (e.g. picked "No category"), which should actually
// remove the old value from Firestore rather than silently leaving it in
// place. Firestore's deleteField() sentinel does exactly that inside
// updateDoc.
function replaceUndefinedWithDeleteField<T extends object>(data: T): DocumentData {
  const result: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = value === undefined ? deleteField() : value;
  }
  return result;
}

export async function addDocument<T extends object>(
  collectionName: string,
  data: T
) {
  const ref = await addDoc(collection(db, collectionName), stripUndefined(data) as DocumentData);
  return ref.id;
}

export async function updateDocument<T extends object>(
  collectionName: string,
  id: string,
  data: Partial<T>
) {
  await updateDoc(doc(db, collectionName, id), replaceUndefinedWithDeleteField(data));
}

export async function deleteDocument(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
}
