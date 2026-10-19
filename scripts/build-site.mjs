// Builds the static site into dist/ from data/*.json. No dependencies, no database:
// the catalog lives in git and scripts/refresh-catalog.mjs keeps it current.
//
//   /                     home
//   /topics/<slug>/       everyday-health topics + student track topics
//   /learn/<slug>/        ordered starter paths (MPH, MHA/MBA)
//   /videos/              searchable library of every video
//   /videos/<id>/         one watch page per video (VideoObject structured data)
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const OUT = "dist";
const BASE = "https://www.masteringessentials.com";
const CHANNEL_ID = "UC8Ux9uG3hYIjKdym7mD-8GA";
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;
const SUBSCRIBE_URL = `${CHANNEL_URL}?sub_confirmation=1`;
const SITE = "Mastering Essentials";
const SOCIAL = [
  { name: "YouTube", url: "https://www.youtube.com/@MasteringEssentials" },
  { name: "TikTok", url: "https://www.tiktok.com/@masteringessentials" },
  { name: "Instagram", url: "https://www.instagram.com/masteringessentials/" },
  { name: "Facebook", url: "https://www.facebook.com/people/Mastering-Essentials/61589283063649/" },
  { name: "Threads", url: "https://www.threads.com/@masteringessentials" }
];
const socialLinks = cls => `<ul class="${cls}">${SOCIAL.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener me" data-event="social_click" lang="en" dir="ltr">${s.name}</a></li>`).join("")}</ul>`;

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const config = await readJson("site.config.json");
const { shorts } = await readJson("data/shorts.json");
const meta = await readJson("data/video-meta.json");
const healthTopics = await readJson("data/health-topics.json");
const learning = await readJson("data/learning.json");

// Written guides: data/guides/<youtube_id>.md, shown under the video on its watch page.
// Format: a front matter block (summary, reviewed, sources as "Name | URL" lines),
// then Markdown limited to ## / ### headings, paragraphs, "- " and "1. " lists, **bold**.
function parseGuide(id, text, where = "guides") {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${where}/${id}.md: missing front matter`);
  const head = { sources: [] };
  let inSources = false;
  for (const line of m[1].split("\n")) {
    if (/^sources:\s*$/.test(line)) { inSources = true; continue; }
    if (inSources && /^\s*-\s+/.test(line)) {
      const [name, url] = line.replace(/^\s*-\s+/, "").split(/\s+\|\s+/);
      if (!/^https:\/\//.test(url || "")) throw new Error(`${where}/${id}.md: bad source line "${line}"`);
      head.sources.push({ name: name.trim(), url: url.trim() });
      continue;
    }
    inSources = false;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) head[kv[1]] = kv[2].trim();
  }
  for (const key of ["summary", "reviewed"]) if (!head[key]) throw new Error(`${where}/${id}.md: missing ${key}`);
  if (head.sources.length < 2) throw new Error(`${where}/${id}.md: needs at least 2 sources`);
  const words = m[2].replace(/\[\[video:[\w-]+\]\]/g, "").split(/\s+/).filter(Boolean).length;
  return { ...head, words, markdown: m[2], html: where === "guides" ? renderMarkdown(m[2]) : "" };
}

// embed(id) renders a "[[video:ID]]" line; headings get ids when an article needs a contents list.
function renderMarkdown(md, { embed = null, headingIds = false } = {}) {
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const out = [];
  let h2 = 0;
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m;
    if ((m = line.match(/^\[\[video:([\w-]{11})\]\]$/))) {
      if (!embed) throw new Error(`video embed not allowed here: ${line}`);
      close(); out.push(embed(m[1])); continue;
    }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      close();
      const id = headingIds && m[1].length === 2 ? ` id="s${++h2}"` : "";
      out.push(`<h${m[1].length}${id}>${inline(m[2])}</h${m[1].length}>`);
      continue;
    }
    if ((m = line.match(/^[-•]\s+(.*)$/)) || (m = line.match(/^\d+[.)]\s+(.*)$/))) {
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join("\n");
}

// Topic articles: data/articles/<slug>.md, long guides at /guides/<slug>/ with shorts
// embedded inline via "[[video:ID]]" lines. Extra front matter: title, topic.
const articles = new Map();
for (const file of (await readdir("data/articles").catch(() => [])).filter(f => f.endsWith(".md"))) {
  const slug = file.slice(0, -3);
  const a = parseGuide(slug, await readFile(`data/articles/${file}`, "utf8"), "articles");
  if (!a.title || !a.topic) throw new Error(`articles/${file}: needs title and topic`);
  a.slug = slug;
  a.videoIds = [...a.markdown.matchAll(/^\[\[video:([\w-]{11})\]\]$/gm)].map(x => x[1]);
  if (!a.videoIds.length) throw new Error(`articles/${file}: embeds no videos`);
  articles.set(slug, a);
}

const guides = new Map();
for (const file of (await readdir("data/guides").catch(() => [])).filter(f => f.endsWith(".md"))) {
  const id = file.slice(0, -3);
  guides.set(id, parseGuide(id, await readFile(`data/guides/${file}`, "utf8")));
}

// ---------- helpers ----------

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const urduDigits = value => String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const MONTHS = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];
const urduDate = iso => {
  const d = new Date(iso);
  return `${urduDigits(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${urduDigits(d.getUTCFullYear())}`;
};
const clock = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
const isoDuration = secs => `PT${Math.floor(secs / 60) ? `${Math.floor(secs / 60)}M` : ""}${secs % 60}S`;
const THUMB_FILE = { maxres: "maxresdefault", standard: "sddefault", high: "hqdefault" };
const thumb = (id, size = "hqdefault") => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
const watchPath = id => `/videos/${id}/`;
const truncate = (text, max) => text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
const jsonLd = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

// Some early uploads have the description glued onto the title. Keep the first sentence.
function cleanTitle(raw) {
  const title = String(raw).replace(/#\S+/g, "").trim();
  for (let i = 0; i < title.length - 1; i++) {
    if (".؟?".includes(title[i]) && !/\s/.test(title[i + 1])) return title.slice(0, i + 1).trim();
  }
  return title;
}

// Description → paragraphs and bullet lists, minus hashtags and follow prompts.
function descriptionBlocks(text) {
  return String(text).split(/\n\s*\n/).map(block => block.trim()).filter(block =>
    block && !/^(#\S+\s*)+$/.test(block) && !/فالو کریں|subscribe/i.test(block)
  ).map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.every(line => /^[•\-–]/.test(line))) {
      return { list: lines.map(line => line.replace(/^[•\-–]\s*/, "")) };
    }
    return { text: lines.join(" ").replace(/\s*#\S+/g, "").trim() };
  }).filter(block => block.list || block.text);
}
const plainSummary = blocks => blocks.map(b => b.text || b.list.join("، ")).join(" ");

// ---------- the catalog ----------

const studentTopics = learning.filter(c => c.kind === "topics" && c.slug !== "everyday-health");
const learnPaths = learning.filter(c => c.kind === "learn");
const topicOf = new Map();
for (const topic of healthTopics) for (const id of topic.ids) topicOf.set(id, topic);
for (const topic of studentTopics) for (const id of topic.ids) if (!topicOf.has(id)) topicOf.set(id, topic);

const videos = shorts.map(v => {
  const m = meta[v.youtube_id];
  if (!m) throw new Error(`No metadata for ${v.youtube_id}; run scripts/refresh-catalog.mjs`);
  const blocks = descriptionBlocks(m.description);
  const title = cleanTitle(v.title);
  return {
    id: v.youtube_id,
    title,
    youtubeUrl: v.url,
    track: v.track,
    format: v.format,
    vertical: m.vertical !== false,
    poster: thumb(v.youtube_id, THUMB_FILE[m.thumbnail] || "hqdefault"),
    published: m.published_at,
    seconds: m.duration_seconds,
    views: m.views,
    blocks,
    summary: truncate(plainSummary(blocks) || title, 155),
    topic: topicOf.get(v.youtube_id) || null,
    guide: guides.get(v.youtube_id) || null
  };
}).sort((a, b) => b.published.localeCompare(a.published));
const byId = new Map(videos.map(v => [v.id, v]));
const health = videos.filter(v => v.track === "HEALTH");
const popular = [...health].sort((a, b) => b.views - a.views);

for (const id of guides.keys()) if (!byId.has(id)) throw new Error(`data/guides/${id}.md has no matching video`);
const articleOf = new Map();
for (const a of articles.values()) {
  if (!healthTopics.some(t => t.slug === a.topic)) throw new Error(`articles/${a.slug}.md: unknown topic ${a.topic}`);
  for (const id of a.videoIds) {
    if (!byId.has(id)) throw new Error(`articles/${a.slug}.md embeds unknown video ${id}`);
    if (!articleOf.has(id)) articleOf.set(id, a);
  }
}
for (const c of [...healthTopics, ...learning]) {
  for (const id of c.ids) if (!byId.has(id)) throw new Error(`${c.slug} lists unknown video ${id}`);
}

const assetVersion = createHash("sha1")
  .update(await readFile("assets/site.css")).update(await readFile("assets/site.js"))
  .digest("hex").slice(0, 10);

// ---------- icons (lucide, MIT) ----------

const ICONS = {
  children: '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  medicines: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  "home-safety": '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6"/><path d="M9 13h6"/>',
  conditions: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  "body-habits": '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  "air-water-heat": '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  "health-sense": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  student: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  arrow: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  play: '<path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5Z" fill="currentColor" stroke="none"/>',
  youtube: '<path fill="currentColor" stroke="none" d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 22 12a31.2 31.2 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/>'
};
const icon = (name, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.student}</svg>`;

// ---------- layout ----------

const ORG = {
  "@type": "Organization",
  "@id": `${BASE}/#organization`,
  name: SITE,
  url: `${BASE}/`,
  logo: `${BASE}/assets/mastering-essentials-logo-mark.svg`,
  sameAs: [CHANNEL_URL, ...SOCIAL.map(s => s.url)]
};

function analytics() {
  const id = config.gaMeasurementId;
  if (!id) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(id)});</script>`;
}

function page({ path, title, description, image, imageAlt, schema = [], body, ogType = "website" }) {
  const url = `${BASE}${path}`;
  const fullTitle = path === "/" ? title : `${title} | ${SITE}`;
  const img = image || `${BASE}/assets/og-default.jpg`;
  return `<!doctype html>
<html lang="ur" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">
<meta name="theme-color" content="#00696d">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ur" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="ur_PK">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(imageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@500;700&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${assetVersion}">
${analytics()}
${schema.length ? jsonLd({ "@context": "https://schema.org", "@graph": schema }) : ""}
</head>
<body>
<a class="skip-link" href="#main">مرکزی مواد پر جائیں</a>
${header(path)}
<main id="main">
${body}
</main>
${footer()}
<script src="/assets/site.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

function header(path) {
  const link = (href, label) =>
    `<a href="${href}"${path === href || (href !== "/" && path.startsWith(href)) ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="/" aria-label="${SITE}، ہوم">
<img src="/assets/mastering-essentials-logo-mark.svg" alt="" width="40" height="40">
<span class="brand-name" lang="en" dir="ltr">Mastering<br>Essentials</span>
</a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><span class="sr-only">مینو</span></button>
<nav class="site-nav" id="site-nav" aria-label="مرکزی">
${link("/#topics", "موضوعات")}
${articles.size ? link("/guides/", "مکمل رہنما") : ""}
${link("/videos/", "تمام ویڈیوز")}
${link("/#students", "طلبہ کے لیے")}
${link("/#about", "ہمارے بارے میں")}
</nav>
<form class="header-search" action="/videos/" role="search">
<label class="sr-only" for="header-q">ویڈیو تلاش کریں</label>
<input id="header-q" name="q" type="search" placeholder="تلاش کریں…" autocomplete="off">
<button type="submit" aria-label="تلاش">${icon("search")}</button>
</form>
<a class="subscribe" href="${SUBSCRIBE_URL}" target="_blank" rel="noopener" data-event="subscribe_click">${icon("youtube")}<span>سبسکرائب</span></a>
</div>
</header>`;
}

function footer() {
  const year = urduDigits(new Date().getUTCFullYear());
  return `<footer class="site-footer">
<div class="wrap footer-inner">
<div class="footer-brand">
<strong lang="en" dir="ltr">Mastering Essentials</strong>
<p>روزمرہ صحت کی آسان اور قابلِ اعتماد باتیں، اردو میں۔</p>
<h2 class="follow-title">ہمیں فالو کریں</h2>
${socialLinks("social")}
</div>
<nav aria-label="موضوعات">
<h2>موضوعات</h2>
<ul>${healthTopics.map(t => `<li><a href="/topics/${t.slug}/">${esc(t.title)}</a></li>`).join("")}</ul>
</nav>
<nav aria-label="مزید">
<h2>مزید</h2>
<ul>
<li><a href="/videos/">تمام ویڈیوز</a></li>
<li><a href="/learn/mph/">پبلک ہیلتھ: آغاز</a></li>
<li><a href="/learn/mhamba/">ہیلتھ کیئر مینجمنٹ: آغاز</a></li>
<li><a href="${CHANNEL_URL}" target="_blank" rel="noopener">یوٹیوب چینل</a></li>
</ul>
</nav>
</div>
<div class="wrap footer-note">
<p>${icon("shield")} یہ ویڈیوز عام معلومات کے لیے ہیں، ڈاکٹر کے مشورے کا متبادل نہیں۔ ہنگامی صورت میں فوراً قریبی ہسپتال جائیں۔</p>
<p>© ${year} <span lang="en" dir="ltr">Mastering Essentials</span></p>
</div>
</footer>`;
}

// ---------- components ----------

function videoCard(v, { eager = false, showTopic = false } = {}) {
  return `<li class="vcard${v.vertical ? "" : " vcard-wide"}" data-title="${esc(v.title)}" data-topic="${esc(v.topic?.slug || "")}" data-track="${esc(v.track)}">
<a href="${watchPath(v.id)}">
<span class="vthumb"><img src="${thumb(v.id)}" alt="" width="480" height="360" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="vdur" dir="ltr">${clock(v.seconds)}</span>${v.guide ? `<span class="vguide">تحریری رہنما</span>` : ""}</span>
<span class="vtitle" dir="auto">${esc(v.title)}</span>
${showTopic && v.topic ? `<span class="vtopic">${esc(v.topic.title)}</span>` : ""}
</a>
</li>`;
}
const videoGrid = (list, opts) => `<ul class="vgrid">${list.map(v => videoCard(v, opts)).join("\n")}</ul>`;
const videoRail = (list, label) => `<ul class="vrail" aria-label="${esc(label)}">${list.map(v => videoCard(v)).join("\n")}</ul>`;

function sectionHead(kicker, title, id, more) {
  return `<div class="section-head">
<div><p class="kicker">${kicker}</p><h2 id="${id}">${title}</h2></div>
${more ? `<a class="more" href="${more.href}">${more.label} ${icon("arrow")}</a>` : ""}
</div>`;
}

function breadcrumbs(items) {
  return `<nav class="crumbs" aria-label="آپ یہاں ہیں"><ol>${items.map((item, i) =>
    i === items.length - 1
      ? `<li aria-current="page">${esc(item.name)}</li>`
      : `<li><a href="${item.path}">${esc(item.name)}</a></li>`).join("")}</ol></nav>`;
}
const breadcrumbSchema = items => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${BASE}${item.path}` }))
});

// ---------- pages ----------

const pages = new Map();

function homePage() {
  const hero = popular.slice(0, 3);
  const latest = health.slice(0, 10);
  const topicCards = healthTopics.map(t => {
    const sample = [...t.ids].map(id => byId.get(id)).sort((a, b) => b.views - a.views).slice(0, 3);
    return `<li><a class="topic-card topic-${t.slug}" href="/topics/${t.slug}/">
<span class="topic-icon">${icon(t.slug)}</span>
<span class="topic-text"><strong>${esc(t.title)}</strong><span>${esc(t.description)}</span></span>
<span class="topic-foot"><span class="topic-count">${urduDigits(t.ids.length)} ویڈیوز</span><span class="topic-thumbs">${sample.map(v => `<img src="${thumb(v.id, "default")}" alt="" width="120" height="90" loading="lazy">`).join("")}</span></span>
</a></li>`;
  }).join("\n");
  const chips = healthTopics.slice(0, 5).map(t => `<a class="chip" href="/topics/${t.slug}/">${esc(t.title)}</a>`).join("");

  const body = `
<section class="hero">
<div class="wrap hero-inner">
<div class="hero-copy">
<p class="kicker">ایک منٹ، ایک کام کی بات</p>
<h1>صحت کی آسان باتیں، اپنی زبان میں</h1>
<p class="lede">بچوں کی دیکھ بھال، دوا کا درست استعمال، کھانا، گھر کی حفاظت اور عام بیماریاں۔ ہر سوال کا مختصر اور معتبر جواب، صاف اردو میں۔</p>
<form class="hero-search" action="/videos/" role="search">
<label class="sr-only" for="hero-q">کس بارے میں جاننا چاہتے ہیں؟</label>
${icon("search")}
<input id="hero-q" name="q" type="search" placeholder="مثلاً: بخار، شوگر، ڈینگی…" autocomplete="off">
<button type="submit">تلاش کریں</button>
</form>
<div class="chips" aria-label="مقبول موضوعات">${chips}</div>
</div>
<div class="hero-stack" aria-hidden="true">
${hero.map((v, i) => `<a class="stack-card stack-${i + 1}" href="${watchPath(v.id)}" tabindex="-1"><img src="${thumb(v.id)}" alt="" width="480" height="360"${i === 0 ? ' fetchpriority="high"' : ""}><span class="stack-play">${icon("play")}</span></a>`).join("")}
</div>
</div>
</section>

<section class="section" aria-labelledby="topics">
<div class="wrap">
${sectionHead("موضوع کے لحاظ سے", "آپ کس بارے میں جاننا چاہتے ہیں؟", "topics")}
<ul class="topic-grid">${topicCards}</ul>
</div>
</section>

${articles.size ? `<section class="section" aria-labelledby="guides">
<div class="wrap">
${sectionHead("تفصیل سے پڑھیں", "مکمل رہنما", "guides", { href: "/guides/", label: "تمام رہنما" })}
${articleCards([...articles.values()])}
</div>
</section>` : ""}

<section class="section section-tint" aria-labelledby="popular">
<div class="wrap">
${sectionHead("ناظرین کی پسند", "سب سے زیادہ دیکھی گئی ویڈیوز", "popular", { href: "/videos/?sort=popular", label: "سب دیکھیں" })}
${videoRail(popular.slice(0, 12), "سب سے زیادہ دیکھی گئی ویڈیوز")}
</div>
</section>

<section class="section" aria-labelledby="latest">
<div class="wrap">
${sectionHead("ہر ہفتے نئی ویڈیوز", "تازہ ترین", "latest", { href: "/videos/", label: `تمام ${urduDigits(videos.length)} ویڈیوز` })}
${videoGrid(latest)}
</div>
</section>

<section class="section" aria-labelledby="about">
<div class="wrap">
${sectionHead("ہمارا طریقہ", "ہم یہ ویڈیوز کیسے بناتے ہیں", "about")}
<ul class="promise">
<li>${icon("shield", "icon icon-lg")}<h3>معتبر ذرائع</h3><p>ہر بات عالمی ادارۂ صحت اور سرکاری صحت اداروں جیسے معتبر ذرائع سے لی جاتی ہے، اور ویڈیو کی تفصیل میں حوالہ دیا جاتا ہے۔</p></li>
<li>${icon("chat", "icon icon-lg")}<h3>صاف اردو</h3><p>مشکل طبی الفاظ کے بجائے وہ زبان جو گھر میں بولی جاتی ہے، تاکہ ہر عمر کے لوگ سمجھ سکیں۔</p></li>
<li>${icon("clock", "icon icon-lg")}<h3>ایک منٹ سے کم</h3><p>ایک ویڈیو، ایک بات۔ جو آج ہی گھر میں آزمائی جا سکے۔</p></li>
</ul>
<p class="disclaimer">${icon("shield")} یہ ویڈیوز عام معلومات کے لیے ہیں۔ علاج یا دوا میں تبدیلی کے لیے ہمیشہ اپنے ڈاکٹر سے مشورہ کریں۔</p>
</div>
</section>

<section class="section section-tint" aria-labelledby="students">
<div class="wrap">
${sectionHead("طلبہ اور پیشہ ور افراد کے لیے", "پبلک ہیلتھ اور ہیلتھ کیئر مینجمنٹ، اردو میں", "students")}
<div class="paths">
${learnPaths.map(p => `<a class="path-card" href="/learn/${p.slug}/">${icon("student", "icon icon-lg")}<strong>${esc(p.title)}</strong><span>${esc(p.description)}</span><span class="more">آغاز کریں ${icon("arrow")}</span></a>`).join("\n")}
</div>
<div class="chips chips-center">${studentTopics.map(t => `<a class="chip" href="/topics/${t.slug}/">${esc(t.title)} <small>${urduDigits(t.ids.length)}</small></a>`).join("")}</div>
</div>
</section>

<section class="cta">
<div class="wrap cta-inner">
<div><h2>ہر روز نئی ویڈیوز</h2><p>جہاں آپ ویڈیوز دیکھتے ہیں، وہیں ہمیں فالو کریں۔</p></div>
${socialLinks("social social-cta")}
</div>
</section>`;

  return page({
    path: "/",
    title: `${SITE} | صحت کی آسان باتیں، اردو میں`,
    description: "روزمرہ صحت پر مختصر اردو ویڈیوز: بچوں کی صحت، دوا کا درست استعمال، کھانا اور غذائیت، گھر کی حفاظت اور عام بیماریاں۔ معتبر ذرائع، آسان زبان۔",
    schema: [
      ORG,
      {
        "@type": "WebSite",
        "@id": `${BASE}/#website`,
        url: `${BASE}/`,
        name: SITE,
        inLanguage: "ur",
        publisher: { "@id": `${BASE}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${BASE}/videos/?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      }
    ],
    body
  });
}

function collectionPage({ path, title, description, kicker, list, crumbs, ordered = false, featured = [] }) {
  const body = `
<section class="page-head">
<div class="wrap">
${breadcrumbs(crumbs)}
<p class="kicker">${kicker} · ${urduDigits(list.length)} ویڈیوز</p>
<h1>${esc(title)}</h1>
<p class="lede">${esc(description)}</p>
</div>
</section>
<section class="section section-tight">
<div class="wrap">
${featured.length ? articleCards(featured) : ""}
${ordered
    ? `<ol class="path-list">${list.map((v, i) => `<li><a href="${watchPath(v.id)}"><span class="step">${urduDigits(i + 1)}</span><img src="${thumb(v.id)}" alt="" width="480" height="360"><span dir="auto">${esc(v.title)}</span></a></li>`).join("")}</ol>`
    : videoGrid(list, { eager: true })}
</div>
</section>`;
  return page({
    path, title, description,
    image: list[0]?.poster,
    schema: [
      ORG,
      {
        "@type": "CollectionPage",
        "@id": `${BASE}${path}#page`,
        url: `${BASE}${path}`,
        name: title,
        description,
        inLanguage: "ur",
        isPartOf: { "@id": `${BASE}/#website` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: list.map((v, i) => ({ "@type": "ListItem", position: i + 1, url: `${BASE}${watchPath(v.id)}` }))
        }
      },
      breadcrumbSchema(crumbs)
    ],
    body
  });
}

function watchPage(v) {
  const topic = v.topic;
  const crumbs = [{ name: "ہوم", path: "/" }];
  if (topic) crumbs.push({ name: topic.title, path: `/topics/${topic.slug}/` });
  else crumbs.push({ name: "تمام ویڈیوز", path: "/videos/" });
  crumbs.push({ name: v.title, path: watchPath(v.id) });

  const pool = topic ? topic.ids.map(id => byId.get(id)) : videos.filter(o => o.track === v.track);
  const related = pool.filter(o => o.id !== v.id).sort((a, b) => b.views - a.views).slice(0, 8);
  if (related.length < 8) {
    related.push(...(v.track === "HEALTH" ? popular : videos).filter(o => o.id !== v.id && !related.includes(o)).slice(0, 8 - related.length));
  }

  const description = v.blocks.map(b => b.list
    ? `<ul>${b.list.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`
    : `<p>${esc(b.text)}</p>`).join("\n");

  const body = `
<article class="watch">
<div class="wrap">
${breadcrumbs(crumbs)}
<div class="watch-grid${v.vertical ? "" : " watch-wide"}">
<div class="player-col">
<button class="player" type="button" data-video="${v.id}" data-title="${esc(v.title)}" aria-label="ویڈیو چلائیں: ${esc(v.title)}">
<img src="${v.vertical ? thumb(v.id) : v.poster}" alt="" width="480" height="360" fetchpriority="high">
<span class="play-btn">${icon("play")}</span>
</button>
</div>
<div class="watch-copy">
${topic ? `<a class="chip chip-soft" href="/topics/${topic.slug}/">${esc(topic.title)}</a>` : ""}
<h1 dir="auto">${esc(v.title)}</h1>
<p class="watch-meta"><time datetime="${v.published.slice(0, 10)}">${urduDate(v.published)}</time> · <span dir="ltr">${clock(v.seconds)}</span></p>
<div class="watch-body" dir="auto">${v.guide ? `<p>${esc(v.guide.summary)}</p>` : description}</div>
${v.guide ? `<a class="guide-jump" href="#guide">مکمل تحریری رہنما پڑھیں ${icon("arrow")}</a>` : ""}
${articleOf.has(v.id) ? `<a class="article-backlink" href="/guides/${articleOf.get(v.id).slug}/">${icon("student")}<span>یہ ویڈیو اس مکمل رہنما کا حصہ ہے: <strong>${esc(articleOf.get(v.id).title)}</strong></span></a>` : ""}
<div class="watch-actions">
<a class="btn" href="${SUBSCRIBE_URL}" target="_blank" rel="noopener" data-event="subscribe_click">${icon("youtube")} سبسکرائب کریں</a>
<a class="btn btn-ghost" href="${esc(v.youtubeUrl)}" target="_blank" rel="noopener">یوٹیوب پر کھولیں</a>
</div>
<p class="disclaimer">${icon("shield")} یہ عام معلومات ہیں، ڈاکٹر کے مشورے کا متبادل نہیں۔</p>
</div>
</div>
</div>
${v.guide ? `<div class="guide" id="guide">
<p class="kicker">تحریری رہنما</p>
<div class="guide-body">${v.guide.html}</div>
<aside class="guide-sources" aria-labelledby="sources-title">
<h2 id="sources-title">ذرائع</h2>
<ol>${v.guide.sources.map(src => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(src.name)}</a></li>`).join("")}</ol>
<p>آخری نظرِ ثانی: <time datetime="${esc(v.guide.reviewed)}">${urduDate(v.guide.reviewed)}</time></p>
</aside>
<p class="disclaimer">${icon("shield")} یہ رہنما عام معلومات کے لیے ہے۔ علاج، دوا یا خوراک میں تبدیلی کے لیے اپنے ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔</p>
</div>` : ""}
</div>
</article>
<section class="section section-tint" aria-labelledby="related">
<div class="wrap">
${sectionHead(topic ? esc(topic.title) : "مزید دیکھیں", "یہ ویڈیوز بھی دیکھیں", "related", topic ? { href: `/topics/${topic.slug}/`, label: "پورا موضوع" } : null)}
${videoGrid(related)}
</div>
</section>`;

  return page({
    path: watchPath(v.id),
    title: v.title,
    description: v.guide ? v.guide.summary : v.summary,
    image: v.poster,
    ogType: v.guide ? "article" : "video.other",
    schema: [
      ORG,
      {
        "@type": "VideoObject",
        "@id": `${BASE}${watchPath(v.id)}#video`,
        name: v.title,
        description: truncate(plainSummary(v.blocks) || v.title, 2000),
        thumbnailUrl: [...new Set([v.poster, thumb(v.id)])],
        uploadDate: v.published,
        duration: isoDuration(v.seconds),
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        url: `${BASE}${watchPath(v.id)}`,
        inLanguage: "ur",
        publisher: { "@id": `${BASE}/#organization` },
        ...(v.views ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.views } } : {})
      },
      ...(v.guide ? [{
        "@type": "Article",
        "@id": `${BASE}${watchPath(v.id)}#guide`,
        headline: v.title,
        description: v.guide.summary,
        inLanguage: "ur",
        datePublished: v.guide.reviewed,
        dateModified: v.guide.reviewed,
        wordCount: v.guide.words,
        image: v.poster,
        author: { "@id": `${BASE}/#organization` },
        publisher: { "@id": `${BASE}/#organization` },
        mainEntityOfPage: `${BASE}${watchPath(v.id)}`,
        video: { "@id": `${BASE}${watchPath(v.id)}#video` },
        citation: v.guide.sources.map(src => src.url)
      }] : []),
      breadcrumbSchema(crumbs)
    ],
    body
  });
}

function articleCards(list) {
  return `<ul class="article-grid">${list.map(a => {
    const cover = byId.get(a.videoIds[0]);
    return `<li><a class="article-card" href="/guides/${a.slug}/">
<span class="article-thumbs">${a.videoIds.slice(0, 3).map(id => `<img src="${thumb(id)}" alt="" width="480" height="360" loading="lazy">`).join("")}</span>
<span class="article-text"><span class="kicker">مکمل رہنما · ${urduDigits(a.videoIds.length)} ویڈیوز</span><strong>${esc(a.title)}</strong><span>${esc(a.summary)}</span></span>
</a></li>`;
  }).join("\n")}</ul>`;
}

function inlineVideo(id) {
  const v = byId.get(id);
  return `<figure class="inline-video">
<button class="player" type="button" data-video="${v.id}" data-title="${esc(v.title)}" aria-label="ویڈیو چلائیں: ${esc(v.title)}">
<img src="${thumb(v.id)}" alt="" width="480" height="360" loading="lazy"><span class="play-btn">${icon("play")}</span>
</button>
<figcaption><strong dir="auto">${esc(v.title)}</strong><span dir="ltr">${clock(v.seconds)}</span><a href="${watchPath(v.id)}">${v.guide ? "ویڈیو کا صفحہ اور تحریری رہنما" : "ویڈیو کا صفحہ"} ${icon("arrow")}</a></figcaption>
</figure>`;
}

function videoSchema(v) {
  return {
    "@type": "VideoObject",
    name: v.title,
    description: truncate(plainSummary(v.blocks) || v.title, 500),
    thumbnailUrl: [...new Set([v.poster, thumb(v.id)])],
    uploadDate: v.published,
    duration: isoDuration(v.seconds),
    embedUrl: `https://www.youtube.com/embed/${v.id}`
  };
}

function articlePage(a) {
  const path = `/guides/${a.slug}/`;
  const topic = healthTopics.find(t => t.slug === a.topic);
  const crumbs = [{ name: "ہوم", path: "/" }, { name: "مکمل رہنما", path: "/guides/" }, { name: a.title, path }];
  const html = renderMarkdown(a.markdown, { embed: inlineVideo, headingIds: true });
  const toc = [...html.matchAll(/<h2 id="(s\d+)">(.*?)<\/h2>/g)];
  const minutes = Math.max(3, Math.round(a.words / 180));
  const vids = a.videoIds.map(id => byId.get(id));
  const body = `
<article class="article">
<div class="wrap">
${breadcrumbs(crumbs)}
<header class="article-head">
<p class="kicker">مکمل رہنما · ${urduDigits(minutes)} منٹ مطالعہ · ${urduDigits(vids.length)} ویڈیوز</p>
<h1>${esc(a.title)}</h1>
<p class="lede">${esc(a.summary)}</p>
<p class="byline"><span lang="en" dir="ltr">Mastering Essentials</span> · آخری نظرِ ثانی: <time datetime="${esc(a.reviewed)}">${urduDate(a.reviewed)}</time></p>
</header>
<div class="article-layout">
<nav class="toc" aria-labelledby="toc-title"><h2 id="toc-title">اس رہنما میں</h2><ol>${toc.map(([, id, text]) => `<li><a href="#${id}">${text}</a></li>`).join("")}</ol></nav>
<div class="article-body guide-body">${html}
<aside class="guide-sources" aria-labelledby="sources-title">
<h2 id="sources-title">ذرائع</h2>
<ol>${a.sources.map(src => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(src.name)}</a></li>`).join("")}</ol>
<p>آخری نظرِ ثانی: <time datetime="${esc(a.reviewed)}">${urduDate(a.reviewed)}</time></p>
</aside>
<p class="disclaimer">${icon("shield")} یہ رہنما عام معلومات کے لیے ہے، ڈاکٹر کے معائنے کا متبادل نہیں۔ ہنگامی صورت میں فوراً قریبی ہسپتال جائیں۔</p>
</div>
</div>
</div>
</article>
<section class="section section-tint" aria-labelledby="all-videos">
<div class="wrap">
${sectionHead(esc(a.title), "اس رہنما کی تمام ویڈیوز", "all-videos", topic ? { href: `/topics/${topic.slug}/`, label: topic.title } : null)}
${videoGrid(vids)}
</div>
</section>`;
  return page({
    path,
    title: a.title,
    description: a.summary,
    image: byId.get(a.videoIds[0]).poster,
    ogType: "article",
    schema: [
      ORG,
      {
        "@type": "Article",
        "@id": `${BASE}${path}#article`,
        headline: a.title,
        description: a.summary,
        inLanguage: "ur",
        datePublished: a.reviewed,
        dateModified: a.reviewed,
        wordCount: a.words,
        image: byId.get(a.videoIds[0]).poster,
        author: { "@id": `${BASE}/#organization` },
        publisher: { "@id": `${BASE}/#organization` },
        mainEntityOfPage: `${BASE}${path}`,
        citation: a.sources.map(src => src.url),
        video: vids.map(videoSchema)
      },
      breadcrumbSchema(crumbs)
    ],
    body
  });
}

function articlesIndexPage() {
  const crumbs = [{ name: "ہوم", path: "/" }, { name: "مکمل رہنما", path: "/guides/" }];
  return page({
    path: "/guides/",
    title: "مکمل رہنما: صحت کے اہم موضوعات تفصیل سے",
    description: "صحت کے اہم موضوعات پر تفصیلی اردو رہنما، ہر ایک میں مختصر ویڈیوز اور معتبر ذرائع کے حوالے۔",
    schema: [ORG, breadcrumbSchema(crumbs)],
    body: `<section class="page-head"><div class="wrap">
${breadcrumbs(crumbs)}
<h1>مکمل رہنما</h1>
<p class="lede">ایک موضوع، پوری بات۔ ہر رہنما میں متعلقہ مختصر ویڈیوز اور معتبر ذرائع کے حوالے شامل ہیں۔</p>
</div></section>
<section class="section section-tight"><div class="wrap">${articleCards([...articles.values()])}</div></section>`
  });
}

function libraryPage() {
  const filters = [
    `<button type="button" class="chip" data-filter="all" aria-pressed="true">سب</button>`,
    ...healthTopics.map(t => `<button type="button" class="chip" data-filter="topic:${t.slug}" aria-pressed="false">${esc(t.title)}</button>`),
    `<button type="button" class="chip" data-filter="track:MPH" aria-pressed="false">پبلک ہیلتھ</button>`,
    `<button type="button" class="chip" data-filter="track:MHA_MBA" aria-pressed="false">ہیلتھ کیئر مینجمنٹ</button>`
  ].join("");
  const crumbs = [{ name: "ہوم", path: "/" }, { name: "تمام ویڈیوز", path: "/videos/" }];
  const ordered = videos.map((v, i) => ({ v, i }));
  const body = `
<section class="page-head">
<div class="wrap">
${breadcrumbs(crumbs)}
<h1>ویڈیو لائبریری</h1>
<p class="lede">${urduDigits(videos.length)} مختصر اردو ویڈیوز۔ موضوع چنیں یا تلاش کریں۔</p>
<div class="library-tools">
<div class="library-search">${icon("search")}<label class="sr-only" for="library-q">ویڈیو تلاش کریں</label><input id="library-q" type="search" placeholder="عنوان سے تلاش کریں…" autocomplete="off"></div>
<label class="sort"><span>ترتیب</span><select id="library-sort"><option value="new">تازہ ترین</option><option value="popular">سب سے زیادہ دیکھی گئی</option></select></label>
</div>
<div class="chips filters" role="group" aria-label="موضوع">${filters}</div>
</div>
</section>
<section class="section section-tight">
<div class="wrap">
<p class="library-status" id="library-status" aria-live="polite"></p>
<ul class="vgrid" id="library-grid">${ordered.map(({ v, i }) => videoCard(v, { showTopic: true }).replace("<li ", `<li data-order="${i}" data-views="${v.views}" `)).join("\n")}</ul>
<p class="library-empty" id="library-empty" hidden>کوئی ویڈیو نہیں ملی۔ کوئی اور لفظ آزمائیں۔</p>
<div class="center"><button class="btn btn-ghost" type="button" id="library-more" hidden>مزید ویڈیوز</button></div>
</div>
</section>`;
  return page({
    path: "/videos/",
    title: "تمام ویڈیوز: صحت پر اردو ویڈیو لائبریری",
    description: `${videos.length} مختصر اردو ویڈیوز: بچوں کی صحت، دوائیں، غذائیت، گھر کی حفاظت، عام بیماریاں، پبلک ہیلتھ اور ہیلتھ کیئر مینجمنٹ۔`,
    schema: [ORG, breadcrumbSchema(crumbs)],
    body
  });
}

function notFoundPage() {
  return page({
    path: "/404.html",
    title: "صفحہ نہیں ملا",
    description: "یہ صفحہ موجود نہیں۔",
    body: `<section class="page-head page-404"><div class="wrap">
<h1>یہ صفحہ نہیں ملا</h1>
<p class="lede">ہو سکتا ہے یہ لنک پرانا ہو۔ نیچے سے تلاش کریں یا ہوم پیج پر جائیں۔</p>
<form class="hero-search" action="/videos/" role="search">${icon("search")}<label class="sr-only" for="nf-q">تلاش</label><input id="nf-q" name="q" type="search" placeholder="مثلاً: بخار، شوگر…"><button type="submit">تلاش کریں</button></form>
<p><a class="btn btn-ghost" href="/">ہوم پیج</a></p>
</div></section>`
  }).replace('<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">', '<meta name="robots" content="noindex">');
}

// ---------- write ----------

pages.set("/", homePage());
for (const t of healthTopics) {
  const list = t.ids.map(id => byId.get(id)).sort((a, b) => b.published.localeCompare(a.published));
  pages.set(`/topics/${t.slug}/`, collectionPage({
    path: `/topics/${t.slug}/`, title: t.title, description: t.description, kicker: "روزمرہ صحت", list,
    featured: [...articles.values()].filter(a => a.topic === t.slug),
    crumbs: [{ name: "ہوم", path: "/" }, { name: t.title, path: `/topics/${t.slug}/` }]
  }));
}
for (const t of studentTopics) {
  pages.set(`/topics/${t.slug}/`, collectionPage({
    path: `/topics/${t.slug}/`, title: t.title, description: t.description, kicker: "طلبہ کے لیے",
    list: t.ids.map(id => byId.get(id)),
    crumbs: [{ name: "ہوم", path: "/" }, { name: "طلبہ کے لیے", path: "/#students" }, { name: t.title, path: `/topics/${t.slug}/` }]
  }));
}
for (const p of learnPaths) {
  pages.set(`/learn/${p.slug}/`, collectionPage({
    path: `/learn/${p.slug}/`, title: p.title, description: p.description, kicker: "ترتیب سے دیکھیں", ordered: true,
    list: p.ids.map(id => byId.get(id)),
    crumbs: [{ name: "ہوم", path: "/" }, { name: "طلبہ کے لیے", path: "/#students" }, { name: p.title, path: `/learn/${p.slug}/` }]
  }));
}
if (articles.size) {
  pages.set("/guides/", articlesIndexPage());
  for (const a of articles.values()) pages.set(`/guides/${a.slug}/`, articlePage(a));
}
pages.set("/videos/", libraryPage());
for (const v of videos) pages.set(watchPath(v.id), watchPage(v));

await rm(OUT, { recursive: true, force: true });
await cp("assets", `${OUT}/assets`, { recursive: true });
for (const [path, html] of pages) {
  const dir = `${OUT}${path}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, html);
}
await writeFile(`${OUT}/404.html`, notFoundPage());

// Sitemap with video extension so Google can index each watch page as a video.
const newest = list => list.map(v => v.published).sort().at(-1).slice(0, 10);
const lastmod = new Map([["/", newest(videos)], ["/videos/", newest(videos)]]);
for (const c of [...healthTopics, ...studentTopics]) lastmod.set(`/topics/${c.slug}/`, newest(c.ids.map(id => byId.get(id))));
for (const p of learnPaths) lastmod.set(`/learn/${p.slug}/`, newest(p.ids.map(id => byId.get(id))));
for (const a of articles.values()) lastmod.set(`/guides/${a.slug}/`, a.reviewed);
if (articles.size) lastmod.set("/guides/", [...articles.values()].map(a => a.reviewed).sort().at(-1));
const xml = s => esc(s);
const urls = [...pages.keys()].map(path => {
  const v = path.startsWith("/videos/") && path !== "/videos/" ? byId.get(path.split("/")[2]) : null;
  return `<url><loc>${BASE}${path}</loc><lastmod>${v ? (v.guide?.reviewed || v.published.slice(0, 10)) : lastmod.get(path)}</lastmod>${v ? `
<video:video><video:thumbnail_loc>${v.poster}</video:thumbnail_loc><video:title>${xml(v.title)}</video:title><video:description>${xml(truncate(plainSummary(v.blocks) || v.title, 2000))}</video:description><video:player_loc>https://www.youtube.com/embed/${v.id}</video:player_loc><video:duration>${v.seconds}</video:duration><video:publication_date>${v.published}</video:publication_date></video:video>` : ""}</url>`;
}).join("\n");
await writeFile(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>
`);

for (const file of ["robots.txt", "_headers", "_redirects", "CNAME"]) await cp(file, `${OUT}/${file}`);
await cp("data/shorts.json", `${OUT}/data/shorts.json`);

const unplaced = health.filter(v => !v.topic);
if (unplaced.length) console.warn(`build-site: ${unplaced.length} health videos have no topic yet (add them to data/health-topics.json): ${unplaced.map(v => v.id).join(" ")}`);
console.log(`build-site: ${guides.size} written guides, ${articles.size} topic articles`);
console.log(`build-site: ${pages.size} pages (${videos.length} watch pages) in ${OUT}/`);
