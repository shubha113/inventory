import { Badge } from "@/components/ui/Badge";
import { getStockHealth } from "@/types";

export function StockHealthBadge({ item }: { item: { quantity: number; reorderLevel: number } }) {
  const health = getStockHealth(item);
  if (health === "out_of_stock") return <Badge tone="danger">Out of stock</Badge>;
  if (health === "low_stock") return <Badge tone="warn">Low stock</Badge>;
  return <Badge tone="ok">In stock</Badge>;
}
