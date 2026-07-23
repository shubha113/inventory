import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { MaterialRequest } from "@/types";

export async function dispatchMaterialRequest(params: {
  requestId: string;
  dispatchedBy: string;
}) {
  const { requestId, dispatchedBy } = params;
  const requestRef = doc(db, "materialRequests", requestId);

  await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) throw new Error("Material request not found.");
    const request = requestSnap.data() as MaterialRequest;

    if (request.status !== "approved") {
      throw new Error("Only approved requests can be dispatched.");
    }

    // All reads must happen before any writes inside a Firestore transaction.
    const materialRefs = request.lines.map((line) =>
      doc(db, "rawMaterials", line.rawMaterialId)
    );
    const materialSnaps = await Promise.all(
      materialRefs.map((ref) => tx.get(ref))
    );

    materialSnaps.forEach((snap, i) => {
      const line = request.lines[i];
      if (!snap.exists())
        throw new Error(`${line.rawMaterialName} no longer exists.`);
      const currentQty = snap.data().quantity ?? 0;
      if (currentQty < line.quantityRequested) {
        throw new Error(
          `Not enough ${line.rawMaterialName} in stock: only ${currentQty} ${line.unit} available.`
        );
      }
    });

    materialSnaps.forEach((snap, i) => {
      const line = request.lines[i];
      const currentQty = snap.data()!.quantity ?? 0;
      const newQty = currentQty - line.quantityRequested;
      const movementRef = doc(collection(db, "stockMovements"));

      tx.update(materialRefs[i], { quantity: newQty, updatedAt: Date.now() });
      tx.set(movementRef, {
        companyId: request.companyId,
        itemType: "rawMaterial",
        itemId: line.rawMaterialId,
        itemName: line.rawMaterialName,
        sku: line.sku,
        type: "out",
        reason: "dispatch",
        quantity: line.quantityRequested,
        quantityAfter: newQty,
        note: `Dispatched against material request ${request.requestNumber}`,
        referenceId: requestId,
        createdBy: dispatchedBy,
        createdAt: Date.now(),
      });
    });

    tx.update(requestRef, {
      status: "dispatched",
      dispatchedBy,
      dispatchedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}