import { XMLParser } from "fast-xml-parser";
import type { NewsItem, NewsSource } from "./types";

const FEEDS = [
  { id: "inertia", name: "The Inertia", url: "https://www.theinertia.com/feed/atom/" },
  { id: "surfer", name: "Surfer", url: "https://www.surfer.com/feed/" },
  { id: "stab", name: "Stab", url: "https://stabmag.com/feed/" },
];

const BOT_UA = "Surfing/1.0 (+https://github.com/mbboisvert/surfing)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
});

let cache: { at: number; sources: NewsSource[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return textOf(record["#text"]);
    if ("text" in record) return textOf(record.text);
  }
  return "";
}

function hrefOf(link: unknown): string {
  if (typeof link === "string") return link.trim();
  if (Array.isArray(link)) {
    const alternate = link.find(
      (item) => item && typeof item === "object" && (item as { rel?: string }).rel === "alternate",
    );
    return hrefOf(alternate ?? link[0]);
  }
  if (link && typeof link === "object" && "href" in link) {
    return String((link as { href?: string }).href ?? "").trim();
  }
  return "";
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/\s+/g, " ")
    .trim();
}

function excerptOf(record: Record<string, unknown>): string {
  const raw =
    textOf(record.description) || textOf(record.summary) || textOf(record.encoded) || textOf(record.content);
  const clean = decode(raw);
  if (clean.length <= 180) return clean;
  const cut = clean.slice(0, 180);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function parseFeedXml(xml: string): NewsItem[] {
  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };
  const nodes = doc.rss?.channel ? asArray(doc.rss.channel.item) : asArray(doc.feed?.entry);
  const items: NewsItem[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    const title = decode(textOf(record.title));
    const url = decode(hrefOf(record.link));
    if (!title || !url.startsWith("http")) continue;
    const date = parseDate(textOf(record.pubDate || record.published || record.updated || record.date));
    items.push({ title, url, date, excerpt: excerptOf(record) });
    if (items.length >= 8) break;
  }
  return items;
}

async function fetchText(url: string, userAgent: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.text();
}

async function loadSource(feed: (typeof FEEDS)[number]): Promise<NewsSource> {
  try {
    let xml = await fetchText(feed.url, BOT_UA);
    if (xml.length < 200) xml = await fetchText(feed.url, BROWSER_UA);
    const items = parseFeedXml(xml);
    if (!items.length) return { ...feed, items: [], error: "The feed was empty." };
    return { id: feed.id, name: feed.name, items };
  } catch (error) {
    console.error(`news ${feed.id}`, error);
    return { id: feed.id, name: feed.name, items: [], error: "Couldn’t load this feed." };
  }
}

export async function loadNews(): Promise<NewsSource[]> {
  if (cache && Date.now() - cache.at < TTL_MS && cache.sources.some((source) => source.items.length)) {
    return cache.sources;
  }
  const sources = await Promise.all(FEEDS.map(loadSource));
  if (sources.some((source) => source.items.length)) cache = { at: Date.now(), sources };
  return sources;
}
