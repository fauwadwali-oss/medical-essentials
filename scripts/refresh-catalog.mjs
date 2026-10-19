// Refreshes data/shorts.json + data/video-meta.json from the YouTube Data API.
// Auth: YOUTUBE_API_KEY, or an OAuth refresh token (YT_CLIENT_ID, YT_CLIENT_SECRET,
// YT_REFRESH_TOKEN). Free: ~10 quota units per run against a 10,000/day allowance.
//
// New uploads get their track from data/category-review.json when reviewed there,
// otherwise HEALTH (everything the channel publishes now is everyday health).
// New HEALTH videos show up in "latest" and the library straight away; add them to
// a topic in data/health-topics.json to place them on a topic page.
import { readFile, writeFile } from "node:fs/promises";

const CHANNEL_ID = process.env.CHANNEL_ID || "UC8Ux9uG3hYIjKdym7mD-8GA";
const API = "https://www.googleapis.com/youtube/v3";

async function authHeaders() {
  if (process.env.YOUTUBE_API_KEY) return { key: process.env.YOUTUBE_API_KEY };
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
    throw new Error("Set YOUTUBE_API_KEY or YT_CLIENT_ID/YT_CLIENT_SECRET/YT_REFRESH_TOKEN.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OAuth refresh failed: ${body.error || res.status}`);
  return { token: body.access_token };
}

const auth = await authHeaders();

async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = {};
  if (auth.key) url.searchParams.set("key", auth.key);
  else headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`YouTube API ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

function seconds(iso) {
  const m = String(iso).match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map(Number);
  return (d || 0) * 86400 + (h || 0) * 3600 + (min || 0) * 60 + (s || 0);
}

// 1. Every public upload, newest first.
const uploads = `UU${CHANNEL_ID.slice(2)}`;
const ids = [];
let pageToken = "";
do {
  const page = await api("playlistItems", {
    part: "contentDetails",
    playlistId: uploads,
    maxResults: 50,
    ...(pageToken ? { pageToken } : {})
  });
  for (const item of page.items) ids.push(item.contentDetails.videoId);
  pageToken = page.nextPageToken || "";
} while (pageToken);

// 2. Details for each.
const meta = {};
for (let i = 0; i < ids.length; i += 50) {
  const page = await api("videos", {
    part: "snippet,contentDetails,statistics,status,player",
    id: ids.slice(i, i + 50).join(","),
    maxHeight: 1280
  });
  for (const v of page.items) {
    if (v.status.privacyStatus !== "public") continue;
    const thumbs = v.snippet.thumbnails || {};
    meta[v.id] = {
      vertical: Number(v.player?.embedHeight) > Number(v.player?.embedWidth),
      thumbnail: ["maxres", "standard", "high"].find(size => thumbs[size]) || "high",
      title: v.snippet.title.trim(),
      published_at: v.snippet.publishedAt,
      duration_seconds: seconds(v.contentDetails.duration),
      views: Number(v.statistics.viewCount || 0),
      description: v.snippet.description || ""
    };
  }
}

// 3. Merge into the catalog.
const catalog = JSON.parse(await readFile("data/shorts.json", "utf8"));
const review = JSON.parse(await readFile("data/category-review.json", "utf8")).videos;
const previous = new Map(catalog.shorts.map(v => [v.youtube_id, v]));
const videos = Object.entries(meta)
  .sort(([, a], [, b]) => b.published_at.localeCompare(a.published_at))
  .map(([id, m]) => {
    const old = previous.get(id) || {};
    // A Short is vertical and at most three minutes; anything else is a regular video.
    const short = m.vertical && m.duration_seconds <= 180;
    return {
      youtube_id: id,
      title: m.title,
      url: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      track: review[id]?.track || old.track || "HEALTH",
      format: short ? "short" : "video",
      vertical: m.vertical,
      published_at: m.published_at,
      duration_seconds: m.duration_seconds
    };
  });

const added = videos.filter(v => !previous.has(v.youtube_id));
const removed = [...previous.keys()].filter(id => !meta[id]);

await writeFile("data/shorts.json", JSON.stringify({
  exported_at: new Date().toISOString(),
  source: { channel_id: CHANNEL_ID, method: "youtube-data-api", ordering: "newest first" },
  count: videos.length,
  shorts: videos
}, null, 2) + "\n");

const metaOut = Object.fromEntries(Object.entries(meta).map(([id, m]) => [id, {
  published_at: m.published_at,
  vertical: m.vertical,
  thumbnail: m.thumbnail,
  duration_seconds: m.duration_seconds,
  views: m.views,
  description: m.description
}]));
await writeFile("data/video-meta.json", JSON.stringify(metaOut, null, 1) + "\n");

console.log(`Catalog: ${videos.length} videos, ${added.length} new, ${removed.length} no longer public.`);
for (const v of added) console.log(`  + ${v.youtube_id} ${v.track} ${v.title}`);
