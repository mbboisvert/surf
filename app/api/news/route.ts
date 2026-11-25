import { loadNews } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sources = await loadNews();
    return Response.json(
      { sources },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("news", error);
    return Response.json({ sources: [], error: "News is unavailable." }, { status: 200 });
  }
}
