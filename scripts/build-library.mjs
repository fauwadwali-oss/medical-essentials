import {readFile,writeFile} from 'node:fs/promises';
const {shorts,exported_at}=JSON.parse(await readFile('data/shorts.json','utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const template=await readFile('dist/topics/public-health.html','utf8');
let html=template.replaceAll('../','').replaceAll('https://www.masteringessentials.com/topics/public-health.html','https://www.masteringessentials.com/library.html')
 .replace(/<title>.*?<\/title>/,'<title>ویڈیو لائبریری | Mastering Essentials</title>')
 .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="روزمرہ صحت، عوامی صحت اور ہیلتھ کیئر مینجمنٹ کی ویڈیوز اردو اور انگریزی عنوانات سے تلاش کریں۔" />')
 .replace(/<meta property="og:title"[^>]*>/,'<meta property="og:title" content="ویڈیو لائبریری | Mastering Essentials" />')
 .replace(/<meta property="og:description"[^>]*>/,'<meta property="og:description" content="روزمرہ صحت، عوامی صحت اور ہیلتھ کیئر مینجمنٹ کی تمام ویڈیوز تلاش کریں۔" />');
const cards=shorts.map(v=>`<article class="video-card library-card" data-track="${v.track}" data-title="${esc(v.title)}"><a href="${esc(v.url)}" target="_blank" rel="noreferrer"><div class="thumb"><img src="https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg" width="480" height="360" loading="lazy" alt="" /><span>${v.track==='HEALTH'?'روزمرہ صحت':v.track==='MHA_MBA'?'MHA/MBA':'MPH'}</span></div><h3 lang="ur" dir="auto">${esc(v.title)}</h3><span class="text-link">یوٹیوب پر دیکھیں ↗</span></a></article>`).join('\n');
const main=`<main class="collection-main" id="content" lang="ur" dir="rtl"><a class="breadcrumb" href="index.html">← ہوم پیج</a><div class="collection-header"><p class="section-kicker">تمام ${shorts.length} ویڈیوز</p><h1>ویڈیو لائبریری</h1><p>اردو یا انگریزی میں عنوان تلاش کریں، یا اپنی دلچسپی کا موضوع منتخب کریں۔</p></div>
<div class="library-search"><label for="video-search">ویڈیو تلاش کریں</label><input id="video-search" type="search" placeholder="مثلاً: صحت، finance، epidemiology" dir="auto" /></div>
<div class="video-controls library-filters" role="group" aria-label="ویڈیو کے موضوعات"><button class="filter-button active" data-library-track="all" aria-pressed="true">سب</button><button class="filter-button" data-library-track="HEALTH" aria-pressed="false">روزمرہ صحت</button><button class="filter-button" data-library-track="MPH" aria-pressed="false">MPH</button><button class="filter-button" data-library-track="MHA_MBA" aria-pressed="false">MHA/MBA</button></div>
<p id="library-status" role="status" aria-live="polite">${shorts.length} ویڈیوز</p><div class="video-grid" id="library-grid">${cards}</div><p id="library-empty" hidden>کوئی ویڈیو نہیں ملی۔ دوسرا لفظ یا موضوع منتخب کریں۔</p><button class="secondary-action" id="load-more" type="button" hidden>مزید ویڈیوز دکھائیں</button><noscript><p>تلاش کے لیے جاوا اسکرپٹ فعال کریں۔ تمام ویڈیوز نیچے موجود ہیں۔</p></noscript></main>`;
html=html.replace(/<main[\s\S]*?<\/main>/,main).replace('</body>','<script src="library.js?v=20260907-1"></script></body>');
await writeFile('dist/library.html',html);
await writeFile('dist/library.js',await readFile('library.js','utf8'));
let sitemap=await readFile('dist/sitemap.xml','utf8');
await writeFile('dist/sitemap.xml',sitemap.replace('</urlset>','<url><loc>https://www.masteringessentials.com/library.html</loc></url>\n</urlset>'));
console.log(`Built searchable library with ${shorts.length} videos.`);
