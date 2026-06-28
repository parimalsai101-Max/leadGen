// Domain types for an SEO-agency lead-gen pipeline.
// A "lead" = a business with a website that (a) we can contact and (b) has SEO
// weaknesses we can pitch to fix.

/** Discovery channels — where we look for businesses.
 * Direct scraping of anti-bot platforms (Yelp, Facebook, Instagram, Reddit) is
 * avoided. LinkedIn is sourced indirectly — via DuckDuckGo result titles, never
 * by hitting the site — so it dodges the bot-block. Google Maps uses the official
 * Places API (key in env), not scraping. */
export type ChannelId =
  | "web" | "yellowpages" | "quora" | "clutch" | "g2" | "crunchbase"
  | "googlemaps" | "linkedin";

/** A saved discovery search: a niche + (optional) location. */
export interface SearchSpec {
  niche: string;       // e.g. "dentist", "plumber", "law firm"
  location?: string;   // e.g. "Austin, TX" — folded into the query
  limit?: number;      // max businesses to pull per run
  channels?: ChannelId[]; // which channels to search (default: all)
}

/** Outreach channels found on a business's own website. */
export interface Outreach {
  emails: string[];
  phones: string[];
  socials: string[];        // LinkedIn, Instagram, Facebook, X, etc.
  contactUrl: string | null;
  people: { name: string; role?: string }[];
}

/** A lightweight on-page SEO audit derived from a scrape — the pitch angle. */
export interface SeoAudit {
  finalUrl: string;
  httpsOk: boolean;
  statusCode: number | null;
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  hasH1: boolean;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  hasFavicon: boolean;
  wordCount: number;
  /** Human-readable problems = talking points for outreach. */
  issues: string[];
  /** 0-100, higher = more/worse SEO problems = better opportunity for us. */
  opportunityScore: number;
}

/** A discovered business before enrichment. */
export interface BusinessCandidate {
  name: string;
  website: string;
  domain: string;
  description: string | null;
  query: string;        // the search that surfaced it
  channel: ChannelId;   // which channel found it
  phone?: string | null; // a phone known at discovery time (e.g. from Google Places)
}

/** A fully-assembled SEO lead. */
export interface Lead {
  name: string;
  website: string;
  domain: string;
  description: string | null;
  query: string;
  channels: ChannelId[]; // every channel that surfaced this business
  outreach: Outreach | null;
  seo: SeoAudit | null;
  /** 0-100 overall lead quality (opportunity + reachability). */
  score: number;
  scoreReasons: string[];
}
