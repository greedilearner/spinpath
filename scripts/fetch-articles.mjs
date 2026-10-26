// Builds articles.json: a rolling 7-day window of articles from free, keyless sources.
// Run daily by .github/workflows/refresh-articles.yml. Node 20+.
import { readFile, writeFile } from "node:fs/promises";

const WEEK_MS = 7 * 24 * 3600 * 1000;
const now = Date.now();
const OUT = new URL("../articles.json", import.meta.url);

const FEEDS = [
  { topic: "Tech", source: "BBC", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { topic: "World", source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { topic: "Business", source: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { topic: "Science", source: "BBC", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
];

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? decode(m[1]) : ""; };
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

async function get(url, as = "text") {
  const r = await fetch(url, { headers: { "user-agent": "spinpath-article-bot" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === "json" ? r.json() : r.text();
}

async function rss({ topic, source, url }) {
  const xml = await get(url);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const it = m[1];
    return { title: pick(it, "title"), url: safeUrl(pick(it, "link")), source, topic, published: new Date(pick(it, "pubDate")).getTime() };
  });
}

async function hn() {
  const since = Math.floor((now - WEEK_MS) / 1000);
  const j = await get(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${since},points>120&hitsPerPage=60`, "json");
  return j.hits.filter((h) => h.url).map((h) => ({
    title: h.title, url: safeUrl(h.url), source: "Hacker News", topic: "Tech", published: h.created_at_i * 1000,
  }));
}

let prev = [];
try { prev = JSON.parse(await readFile(OUT, "utf8")).items || []; } catch {}

const fresh = [];
for (const job of [hn, ...FEEDS.map((f) => () => rss(f))]) {
  try { fresh.push(...(await job())); } catch (e) { console.warn("source failed:", e.message); }
}

const seen = new Set();
const items = [...fresh, ...prev]
  .filter((a) => a.title && a.url && Number.isFinite(a.published) && now - a.published <= WEEK_MS && a.published <= now + 3600e3)
  .filter((a) => (seen.has(a.url) ? false : seen.add(a.url)))
  .sort((a, b) => b.published - a.published)
  .slice(0, 300);

if (!items.length) { console.error("No articles collected; keeping the old file."); process.exit(1); }
await writeFile(OUT, JSON.stringify({ updated: new Date(now).toISOString(), items }, null, 1) + "\n");
console.log(`wrote ${items.length} articles`);
