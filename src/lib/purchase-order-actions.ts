import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { PurchaseOrder, PurchaseOrderLine } from "@/types";

// Receiving a line means: some or all of the ordered raw material has
// physically arrived. This bumps the raw material's quantity, writes a
// stock movement for the audit trail, and updates the purchase order's own
// record of how much has been received — all in one transaction so nothing
// can get out of sync.
export async function receivePurchaseOrderLine(params: {
  purchaseOrderId: string;
  rawMaterialId: string;
  receiveQty: number;
  createdBy: string;
}) {
  const { purchaseOrderId, rawMaterialId, receiveQty, createdBy } = params;
  if (receiveQty <= 0) throw new Error("Quantity must be greater than zero.");

  const poRef = doc(db, "purchaseOrders", purchaseOrderId);
  const materialRef = doc(db, "rawMaterials", rawMaterialId);
  const movementRef = doc(collection(db, "stockMovements"));

  await runTransaction(db, async (tx) => {
    const poSnap = await tx.get(poRef);
    const materialSnap = await tx.get(materialRef);
    if (!poSnap.exists()) throw new Error("Purchase order not found.");
    if (!materialSnap.exists()) throw new Error("Raw material not found.");

    const po = poSnap.data() as PurchaseOrder;
    const material = materialSnap.data();

    const lines: PurchaseOrderLine[] = po.lines.map((line) =>
      line.rawMaterialId === rawMaterialId
        ? {
            ...line,
            quantityReceived: Math.min(line.quantityOrdered, line.quantityReceived + receiveQty),
          }
        : line
    );

    const allReceived = lines.every((l) => l.quantityReceived >= l.quantityOrdered);
    const someReceived = lines.some((l) => l.quantityReceived > 0);
    const newStatus = allReceived ? "received" : someReceived ? "partially_received" : po.status;

    const newQty = (material.quantity ?? 0) + receiveQty;

    tx.update(poRef, { lines, status: newStatus, updatedAt: Date.now() });
    tx.update(materialRef, { quantity: newQty, updatedAt: Date.now() });
    tx.set(movementRef, {
      companyId: po.companyId,
      itemType: "rawMaterial",
      itemId: rawMaterialId,
      itemName: material.name,
      sku: material.sku,
      type: "in",
      reason: "purchase",
      quantity: receiveQty,
      quantityAfter: newQty,
      note: `Received against PO ${po.poNumber}`,
      referenceId: purchaseOrderId,
      createdBy,
      createdAt: Date.now(),
    });
  });
}
