"""Checks dist/ after a build: one H1, unique IDs, canonical + description, valid
JSON-LD, every internal link resolves, every video has a watch page in the sitemap."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import re

root = Path(__file__).resolve().parent.parent / 'dist'
BASE = 'https://www.masteringessentials.com'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links, self.h1, self.canonical, self.description = [], [], 0, None, None
        self.ld, self._in_ld, self._buf = [], False, ''
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'description':
            self.description = a.get('content')
        if tag in ('a', 'img', 'script', 'link') and (a.get('href') or a.get('src')):
            self.links.append(a.get('href') or a.get('src'))
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self._in_ld, self._buf = True, ''

    def handle_data(self, data):
        if self._in_ld:
            self._buf += data

    def handle_endtag(self, tag):
        if tag == 'script' and self._in_ld:
            self.ld.append(json.loads(self._buf))
            self._in_ld = False


def resolve(href):
    path = unquote(urlsplit(href).path)
    target = root / path.lstrip('/')
    return target / 'index.html' if path.endswith('/') else target


pages = {p: Page(p.read_text()) for p in root.rglob('*.html')}
for p, page in pages.items():
    rel = p.relative_to(root)
    assert page.h1 == 1, (rel, 'h1 count', page.h1)
    assert len(page.ids) == len(set(page.ids)), (rel, 'duplicate ids')
    assert page.description, (rel, 'no meta description')
    assert page.canonical and page.canonical.startswith(BASE + '/'), (rel, 'canonical', page.canonical)
    if rel.name != '404.html':
        assert page.ld, (rel, 'no structured data')
    for href in page.links:
        u = urlsplit(href)
        if u.scheme or u.netloc or not u.path:
            continue
        assert u.path.startswith('/'), (rel, 'relative link', href)
        assert resolve(href).exists(), (rel, 'broken link', href)

catalog = json.loads((root / 'data/shorts.json').read_text())['shorts']
slugs = {k: v['slug'] for k, v in json.loads((root.parent / 'data/video-slugs.json').read_text()).items()}
redirects = (root / '_redirects').read_text()
rules = [l for l in redirects.splitlines() if l.strip() and not l.lstrip().startswith('#')]
# Pages treats every rule after the first dynamic one as dynamic (limit 100, extras ignored).
first_dynamic = next((i for i, l in enumerate(rules) if ':' in l.split()[0] or '*' in l.split()[0]), len(rules))
assert first_dynamic <= 2000, ('Cloudflare Pages allows 2,000 static redirects', first_dynamic)
assert len(rules) - first_dynamic <= 100, ('rules after the first dynamic redirect count as dynamic; limit 100', len(rules) - first_dynamic)
sitemap = (root / 'sitemap.xml').read_text()
locs = re.findall(r'<loc>([^<]+)</loc>', sitemap)
assert len(locs) == len(set(locs)), 'duplicate sitemap URLs'
assert len(locs) == len(pages) - 1, ('sitemap vs pages', len(locs), len(pages))
for v in catalog:
    vid = v['youtube_id']
    seg = slugs.get(vid, vid)
    watch = root / 'videos' / seg / 'index.html'
    assert watch.exists(), ('missing watch page', vid)
    assert f"{BASE}/videos/{seg}/" in locs, ('not in sitemap', vid)
    if vid in slugs:
        assert not (root / 'videos' / vid).exists(), ('old id page still built', vid)
        assert f"/videos/{vid}/ /videos/{seg}/ 301" in redirects, ('no redirect from id URL', vid)
    types = [n['@type'] for g in pages[watch].ld for n in g['@graph']]
    assert 'VideoObject' in types, ('no VideoObject', v['youtube_id'])

# Share cards are ours, so their declared 1200x630 size must be true.
for card in (root / 'assets/og').glob('*.jpg'):
    data = card.read_bytes()
    assert data[:2] == b'\xff\xd8', ('share card is not a JPEG', card.name)
    size, i = None, 2
    while i + 9 < len(data) and data[i] == 0xFF:
        marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], 'big')
        if marker in (0xC0, 0xC1, 0xC2):
            size = (int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big'))
            break
        i += 2 + length
    assert size == (1200, 630), ('share card size', card.name, size)
    assert len(data) < 300_000, ('share card too large', card.name, len(data))

print(f'PASS: {len(pages)} pages, {len(catalog)} watch pages, links, H1s, canonicals, JSON-LD, sitemap, slug redirects.')
