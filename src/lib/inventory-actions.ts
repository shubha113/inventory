// The one place where "stock quantity" is actually allowed to change for a
// manual, one-off adjustment. Every stock in / stock out / adjustment goes
// through recordStockMovement so that the item's quantity and the movement
// history can never drift apart — they're written in a single atomic
// Firestore transaction. Works for both finished Products and RawMaterials;
// pass `itemType` to say which one.
import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { ItemType, MovementReason, MovementType } from "@/types";

interface RecordMovementInput {
  itemType: ItemType;
  itemId: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number; // positive number
  note?: string;
  referenceId?: string;
  createdBy: string;
}

function collectionFor(itemType: ItemType) {
  return itemType === "product" ? "products" : "rawMaterials";
}

export async function recordStockMovement(input: RecordMovementInput) {
  const { itemType, itemId, type, reason, quantity, note, referenceId, createdBy } = input;
  if (quantity <= 0) throw new Error("Quantity must be greater than zero.");

  const itemRef = doc(db, collectionFor(itemType), itemId);
  const movementRef = doc(collection(db, "stockMovements"));

  await runTransaction(db, async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Item not found.");

    const item = itemSnap.data();
    const currentQty: number = item.quantity ?? 0;
    const delta = type === "out" ? -quantity : quantity;
    const newQty = currentQty + delta;

    if (newQty < 0) {
      throw new Error(`Not enough stock: only ${currentQty} ${item.unit ?? "units"} available.`);
    }

    tx.update(itemRef, { quantity: newQty, updatedAt: Date.now() });
    tx.set(movementRef, {
      companyId: item.companyId,
      itemType,
      itemId,
      itemName: item.name,
      sku: item.sku,
      type,
      reason,
      quantity,
      quantityAfter: newQty,
      note: note ?? "",
      referenceId: referenceId ?? "",
      createdBy,
      createdAt: Date.now(),
    });
  });

  return movementRef.id;
}
