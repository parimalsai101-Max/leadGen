# Lead Source Map — Where We Gather Leads (Firecrawl-first)

> Goal: a lead-gen SaaS that *actually returns usable leads*. This doc maps every viable
> source, what data we can extract, and **how scrapable it is with Firecrawl** vs. needs
> an API / specialized provider. Sorted by priority for a v1 that works.

## Legend — Scraping Feasibility
- 🟢 **Firecrawl-direct** — public HTML, predictable URLs, low/no anti-bot. Build first.
- 🟡 **Firecrawl + effort** — works but needs proxies, session handling, pagination, or JS render.
- 🔴 **Blocked / ToS-restricted** — actively fights scrapers OR prohibits it. Use official API or a specialized data provider instead. Scraping = bans + legal risk.

---

## TIER 1 — Build These First (🟢 high yield, low friction)

These are public directories with structured business data and rich pages. Best ROI for Firecrawl.

| Source | Data available | Notes |
|---|---|---|
| **Google Maps / Google Business Profiles** | Name, address, phone, website, category, hours, reviews, rating | The #1 source for local/SMB leads. Firecrawl can hit place pages; for scale use Maps via search-result crawling or pair with a Places-style API. |
| **Yelp** | Business name, phone, website, category, location, reviews | Public listing pages scrape well. Good for local services, restaurants, home services. |
| **Yellow Pages / YellowPages.com, Yell (UK)** | Name, phone, address, website, category | Classic structured directory. Easy pagination by category + city. |
| **Industry directories (Clutch, G2, Capterra, GoodFirms)** | Company, services, size, location, website, contact | Gold for B2B/agency leads. G2/Capterra = software buyers & vendors. |
| **Chamber of Commerce / local biz directories** | Company, contact, website, sector | Thousands of city/regional chambers list members publicly. |
| **Yellow-page equivalents per country** (Justdial IN, Gelbe Seiten DE, PagesJaunes FR) | Localized business data | Localize per target market. |

## TIER 2 — High Value, Some Effort (🟡)

| Source | Data | Why / Caveat |
|---|---|---|
| **Company websites (their own /contact, /about, /team)** | Emails, phone, names, roles, social links | Firecrawl's strength. Crawl a domain → extract contacts. Core enrichment step. |
| **Crunchbase** | Company, funding, size, founders, links | Rich B2B/startup data. Has anti-bot; respect ToS — they sell an API. |
| **AngelList / Wellfound** | Startups, founders, hiring signals | Hiring = buying intent. JS-heavy. |
| **Job boards (Indeed, Greenhouse/Lever boards, We Work Remotely)** | Companies actively hiring, tech stack, growth signal | Hiring intent = strong lead signal. Lever/Greenhouse boards are clean HTML 🟢. |
| **Product Hunt** | New products, makers, links | Early-stage founders, launch signal. |
| **Trustpilot / industry review sites** | Companies + reviewer pain points | Reviews reveal switching intent ("looking for alternative to X"). |
| **Real-estate / Zillow-style, BBB, Trade association rosters** | Niche verticals | Pick per ICP. |
| **Eventbrite / Meetup / conference attendee & exhibitor lists** | Companies, organizers, sponsors | Exhibitor lists on event sites scrape well 🟢. |
| **GitHub** | Devs, companies, tech stack, emails (public commits) | Great for dev-tool/B2B-tech ICP. Has an official API — prefer it. |

## TIER 3 — Social Channels (🔴 mostly: use APIs / providers, not raw Firecrawl)

These have the richest intent data but **actively block scraping and restrict it in ToS**. Scraping them directly with Firecrawl will get IPs banned and creates legal exposure. Strategy = official APIs + specialized compliant data providers.

| Channel | Lead value | How to actually get it |
|---|---|---|
| **LinkedIn** 🔴 | Highest B2B value: titles, company, seniority, decision-makers | DO NOT raw-scrape. Use LinkedIn's own tooling (Sales Navigator), or compliant providers (Apollo, ZoomInfo, Cognism, Lusha, RocketReach). |
| **Instagram** 🔴 | Local biz, creators, e-comm, contact in bio | Meta Graph API for business accounts; or compliant providers. |
| **Facebook (Pages / Groups / Marketplace)** 🔴 | Local SMBs, niche communities | Graph API for Pages. Groups = manual/community-led. |
| **X / Twitter** 🟡🔴 | Founders, intent ("anyone recommend a…?"), bios w/ contact | Official API (paid tiers). Public bios occasionally scrapable but rate-limited hard. |
| **TikTok** 🔴 | Creators, local biz, e-comm | Official API / providers. |
| **YouTube** 🟡 | Channels, business contact (about page often lists email) | **YouTube Data API** is clean and generous — prefer it. |
| **Reddit** 🟢🟡 | Intent goldmine (people asking for recommendations/solutions) | Official Reddit API is good. Public threads also crawlable. High intent, low contact data — pair with enrichment. |
| **Discord / Slack communities** 🔴 | Niche pro communities | No scraping; join + bot integrations where allowed. |
| **Quora** 🟡 | Questions = pain points + intent | Public Q&A pages crawlable. |

## TIER 4 — Enrichment & Verification Layer (not discovery — make leads usable)

A lead without a verified email/phone is noise. After discovery, run leads through:

- **Email finding/verification**: Hunter.io, NeverBounce, ZeroBounce, Apollo, Snov.io
- **Company enrichment**: Clearbit/Apollo/Crunchbase (firmographics, size, revenue, tech stack)
- **Tech-stack detection**: BuiltWith, Wappalyzer (target by what tools they already use)
- **Phone validation**: Twilio Lookup / NumVerify

---

## Recommended v1 Architecture (build order)

1. **Firecrawl crawl pipeline** over Tier 1 directories (Google Maps, Yelp, YellowPages, Clutch/G2) by `{category} × {location}`.
2. **Domain-crawl enrichment**: take each company's website → Firecrawl `/extract` for emails, phones, team names, social links.
3. **Intent layer**: Reddit + job-board crawls for buying signals (hiring, "looking for alternative").
4. **Enrichment/verification API layer** (Hunter/Apollo/BuiltWith) to make leads deliverable.
5. **Compliant API connectors** for LinkedIn/Instagram value via Apollo/ZoomInfo/Graph API — never raw-scrape these.
6. **Dedupe + scoring** (firmographic fit + intent signals) → ranked lead list.

## Hard Constraints to Bake In Early
- **Robots.txt + ToS compliance per source** (track per-source legal posture in a config).
- **GDPR/CCPA**: personal data handling, opt-out, lawful basis — required for selling leads in EU/US.
- **CAN-SPAM / outreach compliance** if you also enable contacting.
- Use Firecrawl's proxy/anti-bot features for 🟡 sources; respect rate limits to avoid blocks.

---

# VERIFIED RESEARCH FINDINGS (2026-06-22)
> Source: deep-research pass, 25 sources fetched, 110 claims extracted, 19 confirmed via 3-vote
> adversarial verification, 6 killed. Figures are 2026-current — re-verify vendor pages before
> committing budget. **Not legal advice — get counsel before selling scraped personal data.**

## Firecrawl — actual capabilities & cost (all ✅ high-confidence)
- **Endpoints**: `/scrape`, `/crawl`, `/map`, `/search`, `/extract` — all support JS rendering +
  full browser interaction (wait, click, write, press, scroll, execute JS, screenshot, PDF).
- **Structured extraction**: `/scrape` `json` format takes a **JSON Schema + natural-language prompt**
  → typed lead fields (name, email, company, title) directly. This is our extraction primitive.
- **Credit metering** (base/floor rates): scrape/crawl/map/monitor = **1 credit/page**;
  search = **2 credits / 10 results**; browser interaction = **2 credits/browser-min**.
- **Anti-bot is a 5× multiplier**: `basic` = 1 credit; `enhanced/stealth` = **5 credits/request**;
  `auto` = basic then retry enhanced (1 if basic works, 5 if not). Budget 5× for protected sources.
- ⚠️ **MYTH (refuted 0-3)**: Firecrawl does **NOT** bundle CAPTCHA-solving as a managed feature.
  Don't assume CAPTCHA pages just work.
- **Pricing ladder**: Free $0/1k credits (testing only) · Hobby $16/5k · **Standard $83/mo (annual
  billing), 100k credits, 50 concurrent, 500 scrape req/min ← realistic production floor** ·
  Growth $333/500k · Scale $599/1M · Enterprise custom.
- **Free tier rate limits are too low for production** (scrape 10/min, crawl 1/min, 2 concurrent).

## Per-source verdicts
| Source | Verdict | Why (verified) |
|---|---|---|
| **Greenhouse + Lever ATS boards** | 🟢🟢 **BUILD FIRST** | Public **unauthenticated JSON endpoints**, no anti-bot. `GET api.greenhouse.io/v1/boards/{client}/jobs?content=true` · `GET api.lever.co/v0/postings/{client}?mode=json`. Cleanest, most reliable lead source. |
| **Ashby / Rippling ATS** | 🟢 secondary | Scrapable via JSON/GraphQL (2-1 vote — slightly less certain). |
| **Company websites** | 🟡 enrichment layer | Firecrawl's sweet spot; pair with `/extract` schema for contacts. |
| **Crunchbase** | 🔴 **DEFER** | Cloudflare enterprise anti-bot (7/10 difficulty), much data login-walled, **dynamically-generated CSS class names break selectors**. Needs 5-credit stealth and still unreliable. |
| **LinkedIn** | 🔴 **API/provider only** | **2025 court-entered permanent injunction vs Proxycurl** (forced data deletion; Proxycurl shut down). Aggressive enforcement. Never raw-scrape. |

> ⚠️ **KEY INSIGHT**: Because Greenhouse/Lever expose **free public JSON APIs**, Firecrawl may be
> *overkill* for those specific sources — direct HTTP calls are cheaper & more reliable. Reserve
> Firecrawl credits for the JS-heavy / HTML-only sources (company sites, directories).

## Compliance — load-bearing nuance (✅ verified, ⚠️ not legal advice)
- **CFAA is narrowed for PUBLIC data** (*hiQ v. LinkedIn*, 9th Cir.): scraping publicly-visible
  data "likely" isn't CFAA "access without authorization." BUT...
- **⚠️ hiQ ULTIMATELY LOST**: Nov 2022 found liable for **breach of LinkedIn ToS**; Dec 2022
  settlement = **$500k judgment + CA tort liability** (trespass to chattels, misappropriation) +
  injunction. **CFAA-clear ≠ legal to scrape.** ToS/contract/tort risk stays live.
- **Logged-out vs logged-in line** (*Meta v. Bright Data*, N.D. Cal. Jan 2024, partial SJ): ToS
  binds "users" — a **logged-OFF** scraper isn't bound; **logged-IN** scraping can be ToS-bound.
  (Meta's tortious-interference claim still survived.)
- **Takeaway for us**: prefer sources with **public APIs / permissive ToS** (ATS boards), never
  authenticate into a platform to scrape, and get counsel before **selling** scraped personal data.

## ⚠️ SCOPE GAPS — still UNANSWERED (next research pass)
The verified set did **not** cover: Google Maps, Yelp, Yellow Pages, Clutch, G2, Capterra, Product
Hunt, Reddit page-level scrapability; **provider pricing** (Apollo, ZoomInfo, Cognism, Hunter.io);
and **GDPR / CCPA / CAN-SPAM** specifics for selling lead data. Treat these as open.
