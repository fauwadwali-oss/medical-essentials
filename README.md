# Mastering Essentials

Urdu-first website for the [@MasteringEssentials](https://www.youtube.com/channel/UC8Ux9uG3hYIjKdym7mD-8GA) YouTube channel: short, practical everyday-health videos for families, plus the earlier public-health and healthcare-management lessons for students.

Live at https://www.masteringessentials.com (Cloudflare Pages).

## How it works

A static site with no database and no runtime costs. Everything is generated from JSON in `data/`:

| File | What it holds | Maintained by |
| --- | --- | --- |
| `data/shorts.json` | Every public video: id, title, track, format, date, duration | `scripts/refresh-catalog.mjs` |
| `data/video-meta.json` | Description, views, date, duration per video | `scripts/refresh-catalog.mjs` |
| `data/health-topics.json` | Everyday-health topics and which videos belong to each | by hand |
| `data/learning.json` | Student topics (MPH, MHA/MBA) and the two ordered starter paths | by hand |
| `data/category-review.json` | Reviewed track (HEALTH / MPH / MHA_MBA) for older videos | by hand |
| `site.config.json` | `gaMeasurementId` for Google Analytics 4 (empty = no analytics) | by hand |

`scripts/build-site.mjs` turns that into `dist/`:

- `/` home: search, topic cards, most-watched, latest, student section
- `/topics/<slug>/` one page per topic
- `/learn/mph/`, `/learn/mhamba/` ordered starter paths
- `/videos/` searchable, filterable library of every video
- `/videos/<id>/` a watch page per video, with the description, related videos and `VideoObject` structured data
- `sitemap.xml` (with Google video extension), `_redirects` for old URLs, `404.html`

`scripts/validate-site.py` checks the build (links, one H1 per page, canonicals, JSON-LD, sitemap coverage).

## Local preview

```bash
node scripts/build-site.mjs && python3 scripts/validate-site.py
```

```bash
python3 -m http.server 8799 --directory dist
```

## Keeping the video library current

`.github/workflows/refresh-shorts.yml` runs daily (and on demand). It calls the YouTube Data API, rewrites the two catalog files, commits if anything changed, and redeploys. It costs nothing: about 10 quota units per run against the free 10,000/day.

It needs either `YOUTUBE_API_KEY`, or the OAuth trio `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, as GitHub secrets.

New uploads default to the HEALTH track and appear in "latest" and the library immediately. To put a new video on a topic page, add its id to the right topic in `data/health-topics.json`. The build prints any health videos that have no topic yet.

## Deployment

Every push to `main` runs `.github/workflows/deploy-cloudflare-pages.yml`: build, validate, `wrangler pages deploy dist` to the `medical-essentials` project, and attach `masteringessentials.com` + `www.masteringessentials.com`.

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

The canonical host is `www.masteringessentials.com`. The bare domain should 301 to it with a Cloudflare Redirect Rule (Pages `_redirects` cannot redirect by hostname).

## Analytics

Put the GA4 measurement ID (`G-XXXXXXX`) in `site.config.json`. The site then sends page views plus `video_play`, `search`, `select_content` (library filters) and `subscribe_click` events.
