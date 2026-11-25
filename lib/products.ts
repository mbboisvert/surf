export const PRODUCTS = [
  { id: "tee", name: "Tee", line: "Heavyweight cotton.", env: "SHOPIFY_VARIANT_TEE" },
  { id: "hat", name: "Hat", line: "Washed cotton.", env: "SHOPIFY_VARIANT_HAT" },
  { id: "wax", name: "Wax", line: "Cold and warm.", env: "SHOPIFY_VARIANT_WAX" },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

export const SHOP_ENV = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_STOREFRONT_ACCESS_TOKEN",
  "SHOPIFY_VARIANT_TEE",
  "SHOPIFY_VARIANT_HAT",
  "SHOPIFY_VARIANT_WAX",
] as const;

export function isProductId(value: unknown): value is ProductId {
  return value === "tee" || value === "hat" || value === "wax";
}
