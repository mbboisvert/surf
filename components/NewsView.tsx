"use client";

import { useEffect, useState } from "react";
import type { NewsSource } from "@/lib/types";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString("en-US", options);
}

export function NewsView() {
  const [sources, setSources] = useState<NewsSource[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/news")
      .then((response) => response.json())
      .then((data: { sources?: NewsSource[] }) => {
        if (!cancel) setSources(data.sources ?? []);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (failed) return <p className="feed-error">News is unavailable.</p>;
  if (!sources) return <p className="feed-error">Loading.</p>;

  return (
    <div>
      {sources.map((source) => (
        <section key={source.id} className="source-block" aria-label={source.name}>
          <h2 className="source-name">{source.name}</h2>
          {source.error && source.items.length === 0 ? <p className="feed-error">{source.error}</p> : null}
          {source.items.map((item) => (
            <a key={item.url} className="story" href={item.url} target="_blank" rel="noopener noreferrer">
              <span className="story-title">{item.title}</span>
              {item.excerpt ? <span className="story-excerpt">{item.excerpt}</span> : null}
              {item.date ? <time dateTime={item.date}>{formatDate(item.date)}</time> : null}
            </a>
          ))}
        </section>
      ))}
    </div>
  );
}
