import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeedXml } from "../lib/news.ts";

describe("news feeds", () => {
  it("reads an RSS item", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Wave report</title>
      <link>https://example.com/a?utm_source=rss&amp;#038;utm_medium=rss</link>
      <pubDate>Tue, 24 Nov 2026 22:22:24 +0000</pubDate>
      <description>A short &amp; clean note.</description>
    </item></channel></rss>`;
    const [item] = parseFeedXml(xml);
    assert.equal(item?.title, "Wave report");
    assert.equal(item?.url, "https://example.com/a?utm_source=rss&utm_medium=rss");
    assert.match(item?.excerpt ?? "", /short & clean note/);
    assert.ok(item?.date);
  });

  it("reads an Atom entry", () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry>
      <title>Atom story</title>
      <link rel="alternate" href="https://example.com/b"/>
      <published>2026-11-24T22:22:24Z</published>
      <summary>Hello &lt;b&gt;there&lt;/b&gt;.</summary>
    </entry></feed>`;
    const [item] = parseFeedXml(xml);
    assert.equal(item?.title, "Atom story");
    assert.equal(item?.url, "https://example.com/b");
    assert.match(item?.excerpt ?? "", /Hello/);
  });
});
