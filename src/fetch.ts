import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FEED_URL = "https://www.cbc.ca/podcasting/includes/hourlynews.xml";
const DATA_FILE = path.resolve(__dirname, "../data/entries.json");
const DOCS_FILE = path.resolve(__dirname, "../docs/entries.json");
const SNAPSHOT_DIR = path.resolve(__dirname, "../data/snapshots");
const USER_AGENT = "CBC-Hourly-News-Monitor/1.0";

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
  seenAt: string[];
}

interface ArchiveData {
  feedTitle: string;
  feedLink: string;
  lastFetchedAt: string | null;
  entries: Entry[];
}

async function main() {
  // Fetch the feed
  let xml: string;
  try {
    const response = await fetch(FEED_URL, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      console.log(`Feed returned ${response.status} ${response.statusText}`);
      process.exit(0);
    }
    xml = await response.text();
  } catch (err) {
    console.log(`Failed to fetch feed: ${err}`);
    process.exit(0);
  }

  // Save raw XML snapshot
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "").replace("Z", "Z");
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SNAPSHOT_DIR, `${timestamp}.xml`), xml);
  console.log(`Saved snapshot: ${timestamp}.xml`);

  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  let item: any;
  try {
    const feed = parser.parse(xml);
    const channel = feed?.rss?.channel;
    if (!channel) {
      console.log("No channel found in feed");
      process.exit(0);
    }
    // Handle single item (object) or multiple items (array)
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    item = items[0];
    if (!item) {
      console.log("No items found in feed");
      process.exit(0);
    }
  } catch (err) {
    console.log(`Failed to parse XML: ${err}`);
    process.exit(0);
  }

  // Extract fields
  const guid =
    typeof item.guid === "object" ? item.guid["#text"] : String(item.guid);
  if (!guid) {
    console.log("No guid found in item");
    process.exit(0);
  }

  // Load existing data
  const data: ArchiveData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const existing = data.entries.find((e) => e.guid === guid);

  if (existing) {
    // Record that we saw this entry again
    if (!existing.seenAt) existing.seenAt = [existing.fetchedAt];
    existing.seenAt.push(now.toISOString());
    console.log(`Seen again: ${guid} (${existing.seenAt.length} times)`);
  } else {
    // Build new entry
    const pubDate = item.pubDate ?? "";
    let pubDateISO: string;
    try {
      pubDateISO = new Date(pubDate).toISOString();
    } catch {
      pubDateISO = now.toISOString();
    }

    const entry: Entry = {
      guid,
      title: item.title ?? "",
      description: item.description ?? "",
      summary: item["itunes:summary"] ?? "",
      pubDate,
      pubDateISO,
      duration: item["itunes:duration"] ?? "",
      audioUrl: item.enclosure?.["@_url"] ?? "",
      audioLength: parseInt(item.enclosure?.["@_length"] ?? "0", 10),
      audioType: item.enclosure?.["@_type"] ?? "",
      fetchedAt: now.toISOString(),
      seenAt: [now.toISOString()],
    };

    data.entries.push(entry);
    console.log(`New entry archived: ${guid} (${pubDate})`);
  }
  data.lastFetchedAt = now.toISOString();

  const json = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(DATA_FILE, json);
  fs.writeFileSync(DOCS_FILE, json);
}

main();
