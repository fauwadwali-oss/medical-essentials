from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
root=Path(__file__).resolve().parent.parent/'dist'
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.ids=[];self.links=[];self.h1=0;self.videos=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='h1':self.h1+=1
  if tag in ('a','img','script','link'):
   href=a.get('href') or a.get('src')
   if href:self.links.append(href)
  if tag=='a' and 'youtube.com/' in a.get('href',''):self.videos.append(a['href'])
pages={p:Page(p.read_text()) for p in root.rglob('*.html')}
for p,page in pages.items():
 assert page.h1==1,(p,'h1',page.h1)
 assert len(page.ids)==len(set(page.ids)),(p,'duplicate IDs')
 for href in page.links:
  u=urlsplit(href)
  if u.scheme or u.netloc:continue
  target=(p.parent/unquote(u.path)).resolve() if u.path else p.resolve()
  assert target.exists(),(p,href,'missing file')
  if u.fragment:
   parsed=pages.get(target) or Page(target.read_text())
   assert unquote(u.fragment) in parsed.ids,(p,href,'missing anchor')
data=json.loads((root/'data/shorts.json').read_text())
ids=[v['youtube_id'] for v in data['shorts']]
assert ids and len(ids)==len(set(ids))
assert all(v['url'] in pages[root/'library.html'].videos for v in data['shorts'])
print(f'PASS: {len(pages)} pages, local links/anchors, unique IDs, one H1 per page, all {len(ids)} videos in library.')
