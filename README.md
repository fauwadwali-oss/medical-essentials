# Mastering Essentials

Mastering Essentials is a public-facing education website for public health, healthcare administration, and practical life topics.

Domain: https://masteringessentials.com

## Purpose

This repository is the starter home for the Mastering Essentials website. The first version is a lightweight static site that can be published with GitHub Pages while the brand, content categories, and publishing workflow are still being shaped.

## Editorial Direction

Mastering Essentials is for common public readers, not only students or healthcare professionals. The site should use simple, practical language and focus on:

- public health topics such as prevention, outbreaks, policy, data, and community health
- healthcare administration topics such as hospitals, insurance, access, quality, cost, and leadership
- life topics such as habits, family health, work, stress, decision-making, and daily wellbeing

## Local Preview

Open `index.html` in a browser.

## Shorts Source

The homepage Shorts grid is sourced directly from the `@MasteringEssentials` YouTube channel via the YouTube Data API v3. Shorts metadata is committed to `data/shorts.json` and served as a static asset.

- Channel ID: `UC8Ux9uG3hYIjKdym7mD-8GA`
- Channel: https://www.youtube.com/@MasteringEssentials
- Filter: videos with duration ≤ 180 seconds (Shorts threshold)
- Sort: most recently published first

To refresh after posting new Shorts, run the **Refresh Mastering Essentials shorts** workflow manually from the GitHub Actions tab (`workflow_dispatch`). The workflow runs `scripts/fetch-youtube-shorts.mjs`, regenerates `data/shorts.json`, and auto-commits changes.

Required GitHub secret:

```text
YOUTUBE_API_KEY
```

To run locally:

```bash
YOUTUBE_API_KEY=... node scripts/fetch-youtube-shorts.mjs
```

## GitHub Pages Setup

This repo includes a `CNAME` file for:

```text
masteringessentials.com
```

After GitHub Pages is enabled, point the domain DNS to GitHub Pages:

```text
www CNAME fauwadwali-oss.github.io
```

For the apex domain, add GitHub Pages A records if you want `masteringessentials.com` to redirect or resolve alongside `www.masteringessentials.com`.

## Cloudflare Pages Deployment

Cloudflare Pages is the preferred production host for `masteringessentials.com`.

The repo includes `.github/workflows/deploy-cloudflare-pages.yml`, which:

- builds a clean `dist/` folder from the public site files
- creates the Cloudflare Pages project `medical-essentials` if needed
- deploys `dist/` to Cloudflare Pages
- attaches `masteringessentials.com` and `www.masteringessentials.com`

Required GitHub secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The API token needs permission to manage Cloudflare Pages projects and Pages custom domains for the account that owns the `masteringessentials.com` zone.
