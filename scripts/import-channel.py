"""Import metadata from yt-dlp --flat-playlist --dump-single-json CHANNEL_URL.
Reads public metadata only; keeps source titles and does not infer upload dates.
"""
import json,re,sys
from datetime import datetime,timezone
from pathlib import Path
channel=json.loads(Path(sys.argv[1]).read_text())
assert channel['channel_id']=='UC8Ux9uG3hYIjKdym7mD-8GA','Unexpected channel'
old={v['youtube_id']:v for v in json.loads(Path('data/shorts.json').read_text())['shorts']}
def flatten(node):
 return sum((flatten(n) for n in node['entries']),[]) if 'entries' in node else [node]
entries=flatten(channel)
review=json.loads(Path('data/category-review.json').read_text())['videos']
missing=[v['id'] for v in entries if re.fullmatch(r'[\w-]{11}',v.get('id','')) and (v['id'] not in review or review[v['id']]['title']!=v['title'])]
if missing:
 raise SystemExit('Category review required for new or renamed videos: '+', '.join(missing))
entries.sort(key=lambda v:'/shorts/' not in v.get('url',''))
seen=set(); videos=[]
for v in entries:
 id=v.get('id','')
 if not re.fullmatch(r'[\w-]{11}',id) or id in seen: continue
 seen.add(id); previous=old.get(id,{})
 track=review[id]['track']
 assert track in ('HEALTH','MPH','MHA_MBA'),'Invalid reviewed category'
 row=dict(youtube_id=id,title=v['title'],url=v['url'],track=track,format='short' if '/shorts/' in v['url'] else 'video')
 if previous.get('published_at'):row['published_at']=previous['published_at']
 if v.get('duration') or previous.get('duration_seconds'): row['duration_seconds']=v.get('duration') or previous['duration_seconds']
 videos.append(row)
assert set(old).issubset(seen),'Saved videos are missing from export; review channel removals before updating'
if videos==list(old.values()):
 print('Catalog unchanged')
 raise SystemExit(0)
payload=dict(exported_at=datetime.now(timezone.utc).isoformat(),source=dict(channel_id=channel['channel_id'],method='youtube-public-channel-tabs',ordering='Shorts newest first, then regular videos in tab order'),count=len(videos),shorts=videos)
Path('data/shorts.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
print('Imported',len(videos),'public videos')
