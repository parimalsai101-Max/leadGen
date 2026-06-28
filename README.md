# LeadGen — SEO Agency Lead Finder

Finds **businesses that need SEO help** and hands you everything to close them:
who they are, **how to reach them** (email / phone / socials / contact page), and
**why they need you** (a live on-page SEO audit = your pitch).

> **Search** a niche + city → keep real business websites → **scrape each** for
> contacts **+ SEO audit** → **score** (opportunity + reachability) → manage & export.

Powered by [Firecrawl](https://firecrawl.dev) (web search + scraping + structured
extraction). Built on Next.js with a full admin panel and SQLite persistence.

## How it works

1. **Discovery** — Firecrawl web search for `"{niche} in {city}"`, dropping
   directories/aggregators (Yelp, Zocdoc, BBB, social…) so you get actual businesses.
2. **Enrichment** — scrapes each business site for **outreach** (emails, phones,
   socials, named people, contact page) and runs an **SEO audit** (HTTPS, title,
   meta description, H1, Open Graph, content depth, status code).
3. **Scoring** — 0-100: SEO opportunity (issues to pitch, ≤60) + reachability (≤35)
   + live-site bonus (≤5). High score = needs you *and* you can reach them.
4. **Manage** — pipeline statuses (new → qualified → contacted → won/lost), notes,
   filters, CSV export.

## Admin panel

- **Dashboard** (`/`) — totals, hot leads, leads-with-email, pipeline by status
- **Leads** (`/leads`) — filter/search/sort, SEO issues + outreach per lead, status, notes, **CSV export**
- **Searches** (`/searches`) — define niche + location targets to track
- **Runs** (`/runs`) — trigger discovery across active searches, view history
- **Quick Discover** (`/discover`) — ad-hoc niche/city search (ephemeral)
- **Settings** (`/settings`) — Firecrawl key status, scoring weights

## Setup

```bash
cp .env.example .env.local     # add FIRECRAWL_API_KEY (required — powers everything)
npm run dev                    # http://localhost:3000
```

Then: **Searches** → add e.g. `roofing company` / `Denver, CO` → **Runs** → *Run
discovery now* → **Leads** → work the pipeline, export CSV.

## Architecture

```
src/lib/
  types.ts                    # SearchSpec, Outreach, SeoAudit, Lead
  discovery/businessSearch.ts # Firecrawl search → business candidates (filters aggregators)
  enrich/firecrawl.ts         # scrape site → outreach + SEO audit (1 scrape, /contact fallback)
  seo.ts                      # on-page SEO audit → issues + opportunity score
  score.ts                    # lead score = opportunity + reachability
  pipeline.ts                 # search → enrich (bounded concurrency) → score
  db.ts / repo.ts / runner.ts # SQLite persistence (searches, runs, leads)
src/app/(admin)/              # dashboard, leads, searches, runs, discover, settings
src/app/api/                  # searches, leads (+[id], export), runs, discover
```

## Cost & reliability notes

- Discovery: 1 search (2 credits/10 results) + ~1–2 scrape credits per business
  (`proxy: "auto"` stays at the 1-credit tier unless a site needs stealth = 5).
- Some sites block scrapers (you'll see HTTP 403 → flagged as an SEO issue); that's
  a heuristic, not always a real defect.
- Leads dedupe by domain across runs; status/notes are preserved on re-runs.

## Roadmap

- More discovery angles (Google Places API for ratings/addresses; directory scraping)
- Email verification (Hunter/NeverBounce), deeper multi-page SEO crawl
- Auth + multi-user, Neon Postgres swap (`src/lib/db.ts`) for serverless deploy

## Compliance

Scrapes only businesses' own public sites (permissive posture). For social
platforms (LinkedIn/IG), use official APIs/providers — never raw-scrape. Get
counsel before selling scraped personal data and follow CAN-SPAM/GDPR for outreach.
**Not legal advice.** See [`docs/lead-sources-map.md`](docs/lead-sources-map.md).
