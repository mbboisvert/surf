import type { Metadata } from "next";
import { ShopView } from "@/components/ShopView";

export const metadata: Metadata = {
  title: "Shop · Surfing",
  description: "Tee, hat, and wax. Checkout is on Shopify.",
};

export default function ShopPage() {
  return (
    <main className="sheet-page wide">
      <h1>Shop</h1>
      <ShopView />
    </main>
  );
}
