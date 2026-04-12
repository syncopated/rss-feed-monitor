import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_FILE = path.resolve(__dirname, "../data/entries.json");
const FEED_FILE = path.resolve(__dirname, "../docs/feed.xml");
const FEED_URL =
  "https://syncopated.github.io/rss-feed-monitor/feed.xml";
const MAX_EPISODES = 24;

interface Entry {
  guid: string;
  title: string;
  description: string;
  summary: string;
  pubDate: string;
  pubDateISO: string;
  duration: string;
  audioUrl: string;
  audioLength: number;
  audioType: string;
  fetchedAt: string;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Toronto",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Toronto",
  timeZoneName: "short",
});

function episodeTitle(pubDateISO: string): string {
  const date = new Date(pubDateISO);
  // e.g. "The World This Hour — Sunday, April 12 at 11:00 AM EDT"
  return `The World This Hour — ${dayFmt.format(date)} at ${timeFmt.format(date)}`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  const entries: Entry[] = data.entries
    .slice()
    .sort(
      (a: Entry, b: Entry) =>
        new Date(b.pubDateISO).getTime() - new Date(a.pubDateISO).getTime()
    )
    .slice(0, MAX_EPISODES);

  const items = entries
    .map(
      (entry) => `        <item>
            <guid isPermaLink="false">${esc(entry.guid)}</guid>
            <title>${esc(episodeTitle(entry.pubDateISO))}</title>
            <description>${esc(entry.description)}</description>
            <itunes:summary>${esc(entry.summary)}</itunes:summary>
            <pubDate>${esc(entry.pubDate)}</pubDate>
            <itunes:duration>${esc(entry.duration)}</itunes:duration>
            <itunes:explicit>No</itunes:explicit>
            <enclosure url="${esc(entry.audioUrl)}" length="${entry.audioLength}" type="${esc(entry.audioType)}" />
        </item>`
    )
    .join("\n");

  const year = new Date().getFullYear();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
    <channel>
        <language>en-ca</language>
        <title>${esc(data.feedTitle)}</title>
        <link>${esc(data.feedLink)}</link>
        <description>Catch up on the day's most important news from Canada and around the world in 5 minutes. Updated every hour, 24/7. Last ${MAX_EPISODES} episodes.</description>
        <itunes:summary>Catch up on the day's most important news from Canada and around the world in 5 minutes. Updated every hour, 24/7.</itunes:summary>
        <itunes:owner>
            <itunes:name>CBC</itunes:name>
            <itunes:email>podcasting@cbc.ca</itunes:email>
        </itunes:owner>
        <copyright>Copyright © CBC ${year}</copyright>
        <itunes:category text="News" />
        <itunes:author>CBC</itunes:author>
        <itunes:image href="https://www.cbc.ca/radio/podcasts/images/theworldthishour-3000x3000.jpg"/>
        <itunes:explicit>No</itunes:explicit>
        <image>
            <title>${esc(data.feedTitle)}</title>
            <url>https://www.cbc.ca/radio/podcasts/images/theworldthishour-3000x3000.jpg</url>
            <link>${esc(data.feedLink)}</link>
        </image>
        <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
    </channel>
</rss>
`;

  fs.writeFileSync(FEED_FILE, xml);
  console.log(`Generated feed with ${entries.length} episodes → ${FEED_FILE}`);
}

main();
