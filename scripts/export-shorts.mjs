import { writeFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const PROGRAM_ID = process.env.PROGRAM_ID || "5";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "data/shorts.json";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const params = new URLSearchParams({
  select: "id,title,youtube_id,thumbnail_url,duration_seconds,created_at",
  program_id: `eq.${PROGRAM_ID}`,
  is_published: "eq.true",
  is_trending: "eq.true",
  order: "created_at.desc"
});

const response = await fetch(`${SUPABASE_URL}/rest/v1/shorts?${params}`, {
  headers: {
    apikey: SUPABASE_SECRET_KEY
  }
});

if (!response.ok) {
  const message = await response.text();
  console.error(`Supabase export failed: ${response.status} ${message}`);
  process.exit(1);
}

const rows = await response.json();
const exportedAt = new Date().toISOString();

const payload = {
  exported_at: exportedAt,
  source: {
    project: "masteringseries-platform",
    program_id: Number(PROGRAM_ID),
    program_slug: "medical-essentials",
    table: "public.shorts",
    filters: {
      is_published: true,
      is_trending: true
    }
  },
  count: rows.length,
  shorts: rows.map((short) => ({
    id: short.id,
    title: short.title,
    youtube_id: short.youtube_id,
    thumbnail_url: short.thumbnail_url,
    duration_seconds: short.duration_seconds,
    created_at: short.created_at
  }))
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Exported ${rows.length} Medical Essentials shorts to ${OUTPUT_PATH}`);
