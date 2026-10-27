// Draws the 1200x630 link-preview card (og:image) for each everyday-health video into
// assets/og/<id>.jpg. Our own design, not the YouTube thumbnail, which we may not alter.
// Runs locally on a Mac (headless Chrome renders the Nastaliq; sips writes the JPEG), and
// the cards are committed, so the daily refresh needs no browser. New videos use their
// YouTube thumbnail until a card exists.
//
//   node scripts/make-share-cards.mjs            cards that are missing
//   node scripts/make-share-cards.mjs --force    redraw all
//   node scripts/make-share-cards.mjs <id> ...   just these
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cleanTitle } from "./titles.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "assets/og";
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = new Set(args.filter(a => !a.startsWith("--")));

const { shorts } = JSON.parse(readFileSync("data/shorts.json", "utf8"));
const topics = JSON.parse(readFileSync("data/health-topics.json", "utf8"));
const topicOf = new Map(topics.flatMap(t => t.ids.map(id => [id, t.title])));
const logo = `file://${resolve("assets/mastering-essentials-logo-mark.svg")}`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const todo = shorts.filter(v => v.track === "HEALTH" && (only.size
  ? only.has(v.youtube_id)
  : force || !existsSync(`${OUT}/${v.youtube_id}.jpg`)));
if (!todo.length) { console.log("make-share-cards: nothing to do"); process.exit(0); }
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "share-cards-"));

function card(v) {
  // A card needs the hook, not the caption some early titles carry after it.
  const title = cleanTitle(v.title).split(/(?<=[؟?])\s*|\s*\p{Extended_Pictographic}/u)[0].trim();
  const topic = topicOf.get(v.youtube_id);
  return `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@600;700&display=block">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#00696d;color:#fff;font-family:"Noto Nastaliq Urdu",Inter,serif;position:relative}
.glow{position:absolute;inset:auto auto -220px -160px;width:620px;height:620px;border-radius:50%;background:#0b8a8f;opacity:.45}
.panel{position:absolute;inset:44px;border-radius:32px;background:#fbf8f3;color:#14232a;padding:44px 64px 0;display:flex;flex-direction:column}
.chip{align-self:flex-start;background:#fcefdc;color:#7a430b;border-radius:999px;padding:0 22px;font-size:24px;line-height:2.3}
h1{flex:1;min-height:0;display:flex;align-items:center;font-size:72px;line-height:1.85;font-weight:700;color:#004a4d;overflow:hidden}
h1 span{display:block}
.foot{display:flex;align-items:center;gap:18px;border-top:2px solid #e6dfd3;height:112px}
.foot img{width:66px;height:76px}
.brand{font-family:Inter,sans-serif;font-weight:700;font-size:28px;color:#004a4d;direction:ltr}
.brand small{display:block;font-weight:600;font-size:20px;color:#5b6a6f}
.tag{margin-inline-start:auto;font-size:26px;color:#c46a12}
</style></head><body><div class="glow"></div>
<div class="panel">
${topic ? `<span class="chip">${esc(topic)}</span>` : `<span class="chip">صحت کی آسان باتیں</span>`}
<h1><span>${esc(title)}</span></h1>
<div class="foot"><img src="${logo}" alt=""><div class="brand">Mastering Essentials<small>masteringessentials.com</small></div><span class="tag">صحت کی آسان باتیں، اردو میں</span></div>
</div>
<script>
// Shrink the title until the whole of it fits; Nastaliq line heights vary too much to guess,
// and its descenders hang below the line box, hence the 14% margin.
document.fonts.ready.then(() => {
  const h1 = document.querySelector("h1"), span = h1.firstElementChild;
  for (let size = 72; size > 40 && (span.offsetHeight > h1.clientHeight * 0.86 || span.scrollWidth > h1.clientWidth); size -= 2) h1.style.fontSize = size - 2 + "px";
});
</script></body></html>`;
}

let done = 0;
for (const v of todo) {
  const id = v.youtube_id;
  const html = join(work, `${id}.html`);
  const png = join(work, `${id}.png`);
  writeFileSync(html, card(v));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--virtual-time-budget=6000", "--window-size=1200,630",
    `--screenshot=${png}`, `file://${html}`], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", `${OUT}/${id}.jpg`], { stdio: "ignore" });
  done++;
  if (done % 20 === 0) console.log(`make-share-cards: ${done}/${todo.length}`);
}
rmSync(work, { recursive: true, force: true });
const kb = todo.reduce((sum, v) => sum + statSync(`${OUT}/${v.youtube_id}.jpg`).size, 0) / 1024;
console.log(`make-share-cards: wrote ${done} cards to ${OUT}/ (${Math.round(kb / done)} KB each on average)`);
