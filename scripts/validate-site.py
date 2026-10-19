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
sitemap = (root / 'sitemap.xml').read_text()
locs = re.findall(r'<loc>([^<]+)</loc>', sitemap)
assert len(locs) == len(set(locs)), 'duplicate sitemap URLs'
assert len(locs) == len(pages) - 1, ('sitemap vs pages', len(locs), len(pages))
for v in catalog:
    watch = root / 'videos' / v['youtube_id'] / 'index.html'
    assert watch.exists(), ('missing watch page', v['youtube_id'])
    assert f"{BASE}/videos/{v['youtube_id']}/" in locs, ('not in sitemap', v['youtube_id'])
    types = [n['@type'] for g in pages[watch].ld for n in g['@graph']]
    assert 'VideoObject' in types, ('no VideoObject', v['youtube_id'])

print(f'PASS: {len(pages)} pages, {len(catalog)} watch pages, links, H1s, canonicals, JSON-LD, sitemap.')
