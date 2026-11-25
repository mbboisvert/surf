import { PRODUCTS, SHOP_ENV, isProductId, type ProductId } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CHARGE = "This does not charge.";

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function storeHost(): string | null {
  const raw = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
}

function variantGid(product: ProductId): string | null {
  const productMeta = PRODUCTS.find((item) => item.id === product);
  const raw = productMeta ? process.env[productMeta.env]?.trim() : "";
  if (!raw) return null;
  if (raw.startsWith("gid://")) return raw;
  if (/^\d+$/.test(raw)) return `gid://shopify/ProductVariant/${raw}`;
  return raw;
}

function status() {
  const missing = SHOP_ENV.filter((name) => !present(name));
  const store = Boolean(storeHost() && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim());
  const products = Object.fromEntries(
    PRODUCTS.map((product) => [product.id, store && present(product.env)]),
  );
  return { store, products, missing };
}

function safeCheckout(url: string, domain: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname;
    const allowed =
      host === domain ||
      host.endsWith(".myshopify.com") ||
      host.endsWith(".shopify.com") ||
      host === "shop.app" ||
      host.endsWith(".shop.app");
    return allowed ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return Response.json(status());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const product = body && typeof body === "object" ? (body as { product?: unknown }).product : null;
  if (!isProductId(product)) {
    return Response.json({ ok: false, message: "Unknown product." }, { status: 400 });
  }
  const domain = storeHost();
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();
  if (!domain || !token) {
    return Response.json({
      ok: false,
      message: `Shopify isn’t connected, so this does not charge.`,
    });
  }
  const variant = variantGid(product);
  if (!variant) {
    return Response.json({
      ok: false,
      message: `This product isn’t linked to a Shopify variant, so ${NO_CHARGE.charAt(0).toLowerCase()}${NO_CHARGE.slice(1)}`,
    });
  }
  try {
    const response = await fetch(`https://${domain}/api/2025-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query: `mutation CartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { checkoutUrl }
            userErrors { message }
          }
        }`,
        variables: { input: { lines: [{ merchandiseId: variant, quantity: 1 }] } },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { cartCreate?: { cart?: { checkoutUrl?: string }; userErrors?: Array<{ message?: string }> } };
    } | null;
    const created = payload?.data?.cartCreate;
    const checkoutUrl = created?.cart?.checkoutUrl ? safeCheckout(created.cart.checkoutUrl, domain) : null;
    if (checkoutUrl) return Response.json({ ok: true, checkoutUrl });
    console.error("shopify checkout", created?.userErrors?.[0]?.message ?? response.status);
  } catch (error) {
    console.error("shopify checkout", error);
  }
  return Response.json({
    ok: false,
    message: `Shopify didn’t open a checkout, so this does not charge.`,
  });
}
