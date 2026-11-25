import { forecastAt } from "@/lib/forecast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Need a latitude and longitude." }, { status: 400 });
  }
  try {
    const forecast = await forecastAt(lat, lon);
    return Response.json(forecast, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (error) {
    console.error("forecast", error);
    return Response.json({ error: "Forecast unavailable." }, { status: 502 });
  }
}
