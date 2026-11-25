import type { Metadata } from "next";
import { NewsView } from "@/components/NewsView";

export const metadata: Metadata = {
  title: "News · Surfing",
  description: "Surf news from The Inertia, Surfer, and Stab.",
};

export default function NewsPage() {
  return (
    <main className="sheet-page">
      <h1>News</h1>
      <p className="lede">The Inertia, Surfer, and Stab.</p>
      <NewsView />
    </main>
  );
}
