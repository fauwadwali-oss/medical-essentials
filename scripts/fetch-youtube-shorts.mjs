import { writeFile } from "node:fs/promises";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID || "UC8Ux9uG3hYIjKdym7mD-8GA";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "data/shorts.json";
const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_SECONDS || 180);

if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY.");
  process.exit(1);
}

const API = "https://www.googleapis.com/youtube/v3";

function parseISODuration(iso) {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return Number(h || 0) * 3600 + Number(min || 0) * 60 + Number(s || 0);
}

function cleanTitle(raw) {
  const trimmed = String(raw || "").trim();
  for (let i = 0; i < trimmed.length - 1; i++) {
    const ch = trimmed[i];
    const next = trimmed[i + 1];
    if ((ch === "." || ch === "؟" || ch === "?") && next && next !== " " && next !== "\n") {
      return trimmed.substring(0, i + 1);
    }
  }
  const newlineIdx = trimmed.indexOf("\n");
  if (newlineIdx > 0) return trimmed.substring(0, newlineIdx).trim();
  return trimmed;
}

async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function getUploadsPlaylistId(channelId) {
  const data = await api("channels", { part: "contentDetails", id: channelId });
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`No uploads playlist for channel ${channelId}`);
  return uploads;
}

async function listAllPlaylistItems(playlistId) {
  const items = [];
  let pageToken;
  do {
    const data = await api("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {})
    });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function getDurations(videoIds) {
  const out = new Map();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await api("videos", {
      part: "contentDetails",
      id: batch.join(",")
    });
    for (const v of data.items || []) {
      out.set(v.id, parseISODuration(v.contentDetails.duration));
    }
  }
  return out;
}

const uploadsPlaylist = await getUploadsPlaylistId(CHANNEL_ID);
const playlistItems = await listAllPlaylistItems(uploadsPlaylist);
const videoIds = playlistItems.map((it) => it.contentDetails.videoId);
const durations = await getDurations(videoIds);

const shorts = playlistItems
  .map((it) => ({
    videoId: it.contentDetails.videoId,
    title: it.snippet.title,
    publishedAt: it.contentDetails.videoPublishedAt || it.snippet.publishedAt,
    durationSeconds: durations.get(it.contentDetails.videoId) ?? 0
  }))
  .filter((v) => v.durationSeconds > 0 && v.durationSeconds <= MAX_DURATION_SECONDS)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .map((v) => ({
    youtube_id: v.videoId,
    title: cleanTitle(v.title),
    url: `https://www.youtube.com/shorts/${v.videoId}`,
    published_at: v.publishedAt,
    duration_seconds: v.durationSeconds
  }));

const payload = {
  exported_at: new Date().toISOString(),
  source: {
    channel_id: CHANNEL_ID,
    method: "youtube-data-api-v3",
    uploads_playlist: uploadsPlaylist,
    max_duration_seconds: MAX_DURATION_SECONDS
  },
  count: shorts.length,
  shorts
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Exported ${shorts.length} shorts from ${CHANNEL_ID} to ${OUTPUT_PATH}`);
