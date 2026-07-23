export type UserRole = "admin" | "staff";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: number;
}

// A component/part that gets bought in and used to build finished devices.
export interface RawMaterial {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  supplierId?: string;
  supplierName?: string;
  costPerUnit: number; // what you pay to buy one unit
  quantity: number; // current stock on hand
  reorderLevel: number; // threshold that triggers a "low stock" warning
  unit: string; // e.g. "pcs", "meter", "kg", "roll"
  createdAt: number;
  updatedAt: number;
}

// One line of a Bill of Materials: how much of ONE raw material is needed
// to build a single unit of a product.
export interface BOMLine {
  rawMaterialId: string;
  rawMaterialName: string;
  sku: string;
  unit: string;
  quantityRequired: number; // per 1 unit of the finished product
}

// A finished, sellable device (camera, smart plug, hub, etc).
export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  sellingPrice: number; // what you sell one unit for
  quantity: number; // finished units currently in stock
  reorderLevel: number; // threshold that triggers a "low stock" warning
  unit: string; // e.g. "pcs"
  imageUrl?: string;
  bom: BOMLine[]; // the recipe: which raw materials + how much, to build 1 unit
  createdAt: number;
  updatedAt: number;
}

export type MovementType = "in" | "out" | "adjustment";

export type MovementReason =
  | "purchase" // raw material received from a purchase order
  | "production" // raw material consumed, or finished product created, by manufacturing
  | "sale" // finished product sold to a customer
  | "return" // customer returned stock
  | "damaged" // stock written off as damaged/lost
  | "correction" // manual count correction
  | "dispatch"; // raw material issued out against an internal material request

// Which kind of item a stock movement or line item refers to.
export type ItemType = "product" | "rawMaterial";

export interface StockMovement {
  id: string;
  companyId: string;
  itemType: ItemType;
  itemId: string;
  itemName: string;
  sku: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number; // always a positive number, `type` decides direction
  quantityAfter: number; // stock on hand right after this movement
  note?: string;
  referenceId?: string; // links to a purchase order / sales order / production run, if any
  createdBy: string;
  createdAt: number;
}

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

// Purchase orders buy RAW MATERIALS from a supplier (not finished devices —
// those are manufactured, not purchased).
export interface PurchaseOrderLine {
  rawMaterialId: string;
  rawMaterialName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  costPerUnit: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type CompanyRole = "admin" | "staff";

export interface CompanyMember {
  id: string;
  companyId: string;
  companyName: string;
  uid: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: number;
}

export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "fulfilled"
  | "cancelled";

// Sales orders sell finished PRODUCTS (devices) to a customer.
export interface SalesOrderLine {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
}

export interface SalesOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  customerName: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// A single manufacturing run: "we built N units of this product".
export interface ProductionRun {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  sku: string;
  quantityBuilt: number;
  materialsConsumed: {
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: number;
    unit: string;
  }[];
  createdBy: string;
  createdAt: number;
}

export type MaterialRequestPriority = "low" | "normal" | "urgent";

export type MaterialRequestStatus =
  | "pending" // waiting for review
  | "approved" // approved — ready to be picked/dispatched from stock
  | "rejected" // declined, nothing leaves stock
  | "dispatched" // materials have been issued out of stock
  | "cancelled"; // requester withdrew it before it was actioned

export interface MaterialRequestLine {
  rawMaterialId: string;
  rawMaterialName: string;
  sku: string;
  unit: string;
  quantityRequested: number;
}

// An internal ask for raw materials to be pulled from stock (e.g. for a
// production run, a repair, or anything that isn't a customer sale). This is
// different from a Purchase Order, which brings NEW stock in from a
// supplier — a Material Request only ever moves stock that's already on hand.
export interface MaterialRequest {
  id: string;
  companyId: string;
  requestNumber: string;
  lines: MaterialRequestLine[];
  purpose: string; // why the materials are needed
  neededBy?: number; // optional target date
  priority: MaterialRequestPriority;
  status: MaterialRequestStatus;
  notes?: string;
  requestedBy: string; // uid
  requestedByName: string;
  reviewedBy?: string; // name of whoever approved/rejected it
  dispatchedBy?: string; // name of whoever marked it dispatched
  dispatchedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type StockHealth = "in_stock" | "low_stock" | "out_of_stock";

export function getStockHealth(item: {
  quantity: number;
  reorderLevel: number;
}): StockHealth {
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.reorderLevel) return "low_stock";
  return "in_stock";
}

// Given a product's BOM and how many units you want to build, works out how
// much of each raw material that requires, and whether you currently have enough.
export function calculateMaterialsNeeded(
  bom: BOMLine[],
  quantityToBuild: number,
  rawMaterialsById: Map<string, RawMaterial>,
) {
  return bom.map((line) => {
    const needed = line.quantityRequired * quantityToBuild;
    const available = rawMaterialsById.get(line.rawMaterialId)?.quantity ?? 0;
    return {
      ...line,
      needed,
      available,
      isShort: available < needed,
    };
  });
}
