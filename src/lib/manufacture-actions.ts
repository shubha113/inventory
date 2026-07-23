import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { Product } from "@/types";

// "Building" a product: look at its Bill of Materials, work out how much of
// each raw material is needed for the quantity being built, and — if there's
// enough of everything — deduct all of that raw material stock and add the
// finished units to the product's stock, in one transaction. If even one
// raw material is short, nothing is changed (no half-built runs).
export async function manufactureProduct(params: {
  productId: string;
  quantityToBuild: number;
  createdBy: string;
}) {
  const { productId, quantityToBuild, createdBy } = params;
  if (quantityToBuild <= 0) throw new Error("Quantity to build must be greater than zero.");

  const productRef = doc(db, "products", productId);
  const productionRunRef = doc(collection(db, "productionRuns"));

  await runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error("Product not found.");
    const product = productSnap.data() as Product;

    if (!product.bom || product.bom.length === 0) {
      throw new Error("This product has no Bill of Materials set up yet — add one by editing the product.");
    }

    const materialRefs = product.bom.map((line) => doc(db, "rawMaterials", line.rawMaterialId));
    const materialSnaps = await Promise.all(materialRefs.map((ref) => tx.get(ref)));

    // Validate everything first — a build is all-or-nothing.
    materialSnaps.forEach((snap, i) => {
      const line = product.bom[i];
      if (!snap.exists()) throw new Error(`Raw material "${line.rawMaterialName}" no longer exists.`);
      const available = snap.data().quantity ?? 0;
      const needed = line.quantityRequired * quantityToBuild;
      if (available < needed) {
        throw new Error(
          `Not enough "${line.rawMaterialName}" — need ${needed} ${line.unit}, only ${available} available.`
        );
      }
    });

    const materialsConsumed: { rawMaterialId: string; rawMaterialName: string; quantity: number; unit: string }[] = [];

    materialSnaps.forEach((snap, i) => {
      const line = product.bom[i];
      const ref = materialRefs[i];
      const material = snap.data()!;
      const needed = line.quantityRequired * quantityToBuild;
      const newQty = (material.quantity ?? 0) - needed;

      tx.update(ref, { quantity: newQty, updatedAt: Date.now() });

      const movementRef = doc(collection(db, "stockMovements"));
      tx.set(movementRef, {
        companyId: product.companyId,
        itemType: "rawMaterial",
        itemId: line.rawMaterialId,
        itemName: line.rawMaterialName,
        sku: line.sku,
        type: "out",
        reason: "production",
        quantity: needed,
        quantityAfter: newQty,
        note: `Consumed to build ${quantityToBuild} × ${product.name}`,
        referenceId: productionRunRef.id,
        createdBy,
        createdAt: Date.now(),
      });

      materialsConsumed.push({
        rawMaterialId: line.rawMaterialId,
        rawMaterialName: line.rawMaterialName,
        quantity: needed,
        unit: line.unit,
      });
    });

    const newProductQty = (product.quantity ?? 0) + quantityToBuild;
    tx.update(productRef, { quantity: newProductQty, updatedAt: Date.now() });

    const productMovementRef = doc(collection(db, "stockMovements"));
    tx.set(productMovementRef, {
      companyId: product.companyId,
      itemType: "product",
      itemId: productId,
      itemName: product.name,
      sku: product.sku,
      type: "in",
      reason: "production",
      quantity: quantityToBuild,
      quantityAfter: newProductQty,
      note: "Produced from raw materials",
      referenceId: productionRunRef.id,
      createdBy,
      createdAt: Date.now(),
    });

    tx.set(productionRunRef, {
      companyId: product.companyId,
      productId,
      productName: product.name,
      sku: product.sku,
      quantityBuilt: quantityToBuild,
      materialsConsumed,
      createdBy,
      createdAt: Date.now(),
    });
  });

  return productionRunRef.id;
}
