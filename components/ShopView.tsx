"use client";

import { useEffect, useState } from "react";
import { PRODUCTS, SHOP_ENV, type ProductId } from "@/lib/products";

type Status = {
  store: boolean;
  products: Record<string, boolean>;
  missing: string[];
};

function Mark({ id }: { id: ProductId }) {
  if (id === "tee") {
    return (
      <svg className="mark" viewBox="0 0 76 64" aria-hidden>
        <path
          d="M26 12h24l12 8-6 7-6-4v29H20V23l-6 4-6-7 12-8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
      </svg>
    );
  }
  if (id === "hat") {
    return (
      <svg className="mark" viewBox="0 0 76 64" aria-hidden>
        <path d="M18 40c8-16 32-16 40 0" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <path d="M14 40h48" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <path d="M26 40v-4c0-8 24-8 24 0v4" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    );
  }
  return (
    <svg className="mark" viewBox="0 0 76 64" aria-hidden>
      <rect x="24" y="14" width="28" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function ShopView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<ProductId | null>(null);
  const [notes, setNotes] = useState<Partial<Record<ProductId, string>>>({});

  useEffect(() => {
    let cancel = false;
    fetch("/api/checkout")
      .then((response) => response.json())
      .then((data: Status) => {
        if (!cancel) setStatus(data);
      })
      .catch(() => {
        if (!cancel) setStatus(null);
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function checkout(id: ProductId) {
    setPending(id);
    setNotes((current) => ({ ...current, [id]: "" }));
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: id }),
      });
      const data = (await response.json()) as { ok?: boolean; checkoutUrl?: string; message?: string };
      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setNotes((current) => ({
        ...current,
        [id]: data.message || "This does not charge.",
      }));
    } catch {
      setNotes((current) => ({ ...current, [id]: "Checkout didn’t open, so this does not charge." }));
    } finally {
      setPending(null);
    }
  }

  const connected = status != null && status.missing.length === 0;

  return (
    <>
      <p className="lede">
        {connected
          ? "Checkout opens on Shopify."
          : "Checkout is on Shopify. If no store is connected, nothing is charged."}
      </p>
      <div className="products">
        {PRODUCTS.map((product) => (
          <article key={product.id} className="product">
            <Mark id={product.id} />
            <h2>{product.name}</h2>
            <p className="line">{product.line}</p>
            <button
              type="button"
              className="checkout"
              disabled={pending === product.id}
              onClick={() => checkout(product.id)}
            >
              {pending === product.id ? "Opening" : "Checkout"}
            </button>
            <p className="note">{notes[product.id] || ""}</p>
          </article>
        ))}
      </div>
      <div className="wiring">
        <p>Checkout uses Shopify’s Storefront API and sends the buyer to Shopify to pay. Set these on the server:</p>
        <ul>
          {SHOP_ENV.map((name) => {
            const known = status != null;
            const missing = known && status.missing.includes(name);
            return (
              <li key={name}>
                <code>{name}</code>
                {known ? <span>{missing ? " not set" : " set"}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
