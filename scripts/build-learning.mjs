import {readFile, writeFile, mkdir} from 'node:fs/promises';
const collections = JSON.parse(await readFile('data/learning.json','utf8'));
const {shorts} = JSON.parse(await readFile('data/shorts.json','utf8'));
const byId = new Map(shorts.map(v=>[v.youtube_id,v]));
const home = await readFile('dist/index.html','utf8');
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base = 'https://www.masteringessentials.com/';
const routes = [];
for (const collection of collections) {
 const {kind,slug,title,description,ids} = collection;
 const route = `${kind}/${slug}.html`;
 for(const id of ids) if(!byId.has(id)) throw new Error(`Missing curated lesson: ${id}`);
 let head = home.slice(0,home.indexOf('<body>'))
  .replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)} | Mastering Essentials</title>`)
  .replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${esc(description)}" />`)
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,'')
  .replaceAll('href="assets/','href="../assets/').replace('href="styles.css','href="../styles.css')
  .replaceAll('href="'+base+'"','href="'+base+route+'"')
  .replace(/<meta property="og:url"[^>]*>/,`<meta property="og:url" content="${base+route}" />`)
  .replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${esc(title)}" />`)
  .replace(/<meta\s+property="og:description"[\s\S]*?\/>/,`<meta property="og:description" content="${esc(description)}" />`);
 const header = home.match(/<header class="site-header">[\s\S]*?<\/header>/)[0].replaceAll('href="#','href="../index.html#').replaceAll('src="assets/','src="../assets/').replaceAll('href="library.html"','href="../library.html"');
 const rows=ids.map(id=>{
  const v=byId.get(id);
  return `<li><a class="lesson-link" href="${esc(v.url || `https://www.youtube.com/watch?v=${id}`)}" target="_blank" rel="noreferrer"><div><h2 dir="auto">${esc(v.title)}</h2><span class="text-link">یوٹیوب پر دیکھیں ↗</span></div><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" width="480" height="270" loading="lazy" /></a></li>`;
 }).join('\n');
 const body = `<body><a class="skip-link" href="#content" lang="ur" dir="rtl">مرکزی مواد پر جائیں</a>${header}
 <main class="collection-main" id="content" lang="ur" dir="rtl">
 <a class="breadcrumb" href="../index.html#${kind==='learn'?'start':'topics'}">← ${kind==='learn'?'دونوں ٹریکس دیکھیں':'تمام موضوعات'}</a>
 <div class="collection-header"><p class="section-kicker">${kind==='learn'?'ابتدائی راستہ · ترتیب سے سیکھیں':'موضوع کے لحاظ سے منتخب اسباق'} · ${ids.length} ویڈیوز</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>
 <ol class="lesson-list">${rows}</ol>
 <nav class="collection-nav" aria-label="مزید اسباق"><a class="secondary-action" href="../index.html#topics">مزید موضوعات</a><a class="secondary-action" href="../index.html#videos">تازہ ویڈیوز</a></nav>
 </main><footer class="site-footer"><span>Mastering Essentials</span><span lang="ur" dir="rtl">یہ مواد صرف تعلیم کے لیے ہے۔</span></footer><script src="../app.js?v=20260907-1"></script></body></html>`;
 await mkdir(`dist/${kind}`,{recursive:true});
 await writeFile(`dist/${route}`, head+body);
 routes.push(base+route);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[base,...routes].map(url=>`<url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile('dist/sitemap.xml',sitemap);
console.log(`Built ${routes.length} learning and topic pages.`);
