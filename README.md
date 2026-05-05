# Medical Essentials

Medical Essentials is a public-facing education website for public health, healthcare administration, and practical life topics.

Domain: https://masteringessentials.com

## Purpose

This repository is the starter home for the Medical Essentials website. The first version is a lightweight static site that can be published with GitHub Pages while the brand, content categories, and publishing workflow are still being shaped.

## Editorial Direction

Medical Essentials is for common public readers, not only students or healthcare professionals. The site should use simple, practical language and focus on:

- public health topics such as prevention, outbreaks, policy, data, and community health
- healthcare administration topics such as hospitals, insurance, access, quality, cost, and leadership
- life topics such as habits, family health, work, stress, decision-making, and daily wellbeing

## Local Preview

Open `index.html` in a browser.

## Supabase Shorts Source

The homepage includes a Trending Shorts section seeded from the `Medical Essentials` program in the existing `masteringseries-platform` Supabase project.

- Supabase project URL: `https://sayghkqlrfsszgdjxyfh.supabase.co`
- Program slug: `medical-essentials`
- Program ID: `5`
- Source table: `public.shorts`
- Filter: `program_id = 5`, `is_published = true`, `is_trending = true`

Do not put Supabase secret keys in this public GitHub Pages website. The repo uses `.github/workflows/refresh-shorts.yml` to keep the secret in GitHub Actions and export public-safe data to `data/shorts.json`.

Required GitHub secret:

```text
SUPABASE_SECRET_KEY
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
