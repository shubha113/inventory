import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { SalesOrder } from "@/types";

// Fulfilling an order means the finished goods are actually leaving the
// shelf. This reduces stock for every line item and writes one stock
// movement per product, all inside a single transaction — if any product
// doesn't have enough stock, the whole fulfillment is rejected so nothing
// goes negative.
export async function fulfillSalesOrder(params: { salesOrderId: string; createdBy: string }) {
  const { salesOrderId, createdBy } = params;
  const soRef = doc(db, "salesOrders", salesOrderId);

  await runTransaction(db, async (tx) => {
    const soSnap = await tx.get(soRef);
    if (!soSnap.exists()) throw new Error("Sales order not found.");
    const so = soSnap.data() as SalesOrder;

    if (so.status === "fulfilled") throw new Error("This order has already been fulfilled.");

    const productRefs = so.lines.map((line) => doc(db, "products", line.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // Validate all lines first so a partial failure can't leave stock half-updated.
    productSnaps.forEach((snap, i) => {
      const line = so.lines[i];
      if (!snap.exists()) throw new Error(`Product "${line.productName}" no longer exists.`);
      const currentQty = snap.data().quantity ?? 0;
      if (currentQty < line.quantity) {
        throw new Error(`Not enough stock for "${line.productName}" (only ${currentQty} left).`);
      }
    });

    productSnaps.forEach((snap, i) => {
      const line = so.lines[i];
      const ref = productRefs[i];
      const product = snap.data()!;
      const newQty = (product.quantity ?? 0) - line.quantity;

      tx.update(ref, { quantity: newQty, updatedAt: Date.now() });

      const movementRef = doc(collection(db, "stockMovements"));
      tx.set(movementRef, {
        companyId: so.companyId,
        itemType: "product",
        itemId: line.productId,
        itemName: line.productName,
        sku: line.sku,
        type: "out",
        reason: "sale",
        quantity: line.quantity,
        quantityAfter: newQty,
        note: `Fulfilled against order ${so.orderNumber}`,
        referenceId: salesOrderId,
        createdBy,
        createdAt: Date.now(),
      });
    });

    tx.update(soRef, { status: "fulfilled", updatedAt: Date.now() });
  });
}
