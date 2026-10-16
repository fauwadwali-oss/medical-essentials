import { cp, mkdir, copyFile, rm, readFile, writeFile } from "node:fs/promises";

const outputDir = "dist";
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "CNAME",
  "_headers",
  "robots.txt",
  "sitemap.xml"
];

// --- Homepage video card pre-rendering (mirrors app.js so no-JS visitors and
// crawlers get real, linked, thumbnailed cards; app.js re-renders identically). ---

const URDU_RANGE = /[؀-ۿݐ-ݿ]/;
const MHAMBA_HINTS = [
  "mha", "mba", "mhamba", "cphq", "healthcare", "hospital", "leadership",
  "quality", "admin", "management", "finance", "accounting", "cost",
  "insurance", "policy"
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function leadsWithUrdu(title) {
  for (const char of title.trim()) {
    if (URDU_RANGE.test(char)) return true;
    if (/[A-Za-z]/.test(char)) return false;
  }
  return false;
}

function classifyTrack(title) {
  const normalized = title.toLowerCase();
  return MHAMBA_HINTS.some((hint) => normalized.includes(hint)) ? "mhamba" : "mph";
}

function normalizeTrack(short, title) {
  if (short.track === "HEALTH") return "health";
  if (short.track === "MHA_MBA" || short.track === "mhamba") return "mhamba";
  if (short.track === "MPH" || short.track === "mph") return "mph";
  return classifyTrack(title);
}

function homepageShorts(shorts, filter = "all") {
  return shorts.map(short => ({...short, homepageTrack: normalizeTrack(short, short.title || "")}))
    .filter(short => filter === "all" || short.homepageTrack === filter).slice(0, 8);
}

function renderCard(short) {
  const title = short.title || "Mastering Essentials کی اردو ویڈیو";
  const track = short.homepageTrack || normalizeTrack(short, title);
  const trackLabel = track === "health" ? "صحت" : track === "mhamba" ? "MHA/MBA" : "MPH";
  const safeTitle = escapeHtml(title);
  const rawId = short.youtube_id || "";
  const youtubeId = encodeURIComponent(rawId);
  const url = short.url || `https://www.youtube.com/shorts/${youtubeId}`;
  const thumb = rawId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "";
  const titleLang = ' lang="ur" dir="auto"';
  const thumbImg = thumb
    ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" width="480" height="360" onerror="this.remove()" />`
    : "";
  const desc = track === "health" ? "روزمرہ صحت کے بارے میں اردو ویڈیو۔" : track === "mhamba"
    ? "ہیلتھ کیئر مینجمنٹ، فنانس، accounting اور leadership آسان اردو میں۔"
    : "عوامی صحت، بچاؤ، policy اور health systems آسان اردو میں۔";

  return `          <article class="video-card" data-track="${track}">
            <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="${safeTitle}">
              <div class="thumb ${track === "mhamba" ? "thumb-gold" : "thumb-teal"}">
                ${thumbImg}
                <span>${trackLabel}</span>
                <small lang="ur" dir="rtl">دیکھیں</small>
              </div>
              <h3${titleLang}>${safeTitle}</h3>
              <p lang="ur" dir="rtl">${desc}</p>
            </a>
          </article>`;
}

async function renderVideoGrid(html) {
  let shorts = [];
  try {
    const payload = JSON.parse(await readFile("data/shorts.json", "utf8"));
    if (Array.isArray(payload.shorts)) shorts = payload.shorts;
  } catch (error) {
    console.warn("build-site: could not read data/shorts.json, leaving placeholder cards.", error.message);
    return html;
  }
  if (!shorts.length) return html;

  const selected = homepageShorts(shorts);
  const cards = selected.map(renderCard).join("\n");
  const pattern = /(<div class="video-grid" id="video-grid">)[\s\S]*?(<\/div>\s*<\/section>)/;
  if (!pattern.test(html)) {
    console.warn("build-site: video-grid marker not found; skipping pre-render.");
    return html;
  }
  console.log(`build-site: pre-rendered ${selected.length} homepage video cards.`);
  return html.replace(pattern, `$1\n${cards}\n        $2`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(`${outputDir}/data`, { recursive: true });
await cp("assets", `${outputDir}/assets`, { recursive: true });

for (const file of files) {
  if (file === "index.html") {
    let html = await readFile("index.html", "utf8");
    const catalog = JSON.parse(await readFile("data/shorts.json", "utf8"));
    const collections = JSON.parse(await readFile("data/learning.json", "utf8"));
    const count = String(catalog.shorts.length).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
    html = html.replace(/تمام [۰-۹0-9]+ ویڈیوز تلاش کریں/, `تمام ${count} ویڈیوز تلاش کریں`);
    for (const collection of collections.filter(c => c.kind === "topics")) {
      const start = html.indexOf(`href="topics/${collection.slug}.html"`);
      if (start < 0) throw new Error(`Missing topic link: ${collection.slug}`);
      const spanStart = html.indexOf("<span>", start) + 6;
      const spanEnd = html.indexOf("</span>", spanStart);
      html = html.slice(0, spanStart) + `${collection.ids.length} ویڈیوز` + html.slice(spanEnd);
    }
    await writeFile(`${outputDir}/index.html`, await renderVideoGrid(html));
  } else {
    await copyFile(file, `${outputDir}/${file}`);
  }
}

await copyFile("data/shorts.json", `${outputDir}/data/shorts.json`);

console.log(`Built static site in ${outputDir}`);

await import("./build-learning.mjs");
await import("./build-library.mjs");
