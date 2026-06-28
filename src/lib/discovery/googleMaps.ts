import type { SearchSpec, BusinessCandidate } from "@/lib/types";
import { hostFromUrl, isAggregator } from "@/lib/discovery/businessSearch";
import { isMicrosite, pickName } from "@/lib/discovery/quality";

// Google Maps discovery via the official Places API (Text Search, v1).
// Highest-quality source: returns business name, website, phone, address and
// rating directly. Free within Google's monthly allowance. Requires
// GOOGLE_PLACES_API_KEY in the environment — if absent, this channel no-ops so
// the rest of discovery still runs.
//
// Docs: node_modules/next aside — https://developers.google.com/maps/documentation/places/web-service/text-search

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const MAX_PAGES = 3; // 20 results/page → up to 60 candidates per query

interface PlaceDisplayName {
  text?: string;
}
interface Place {
  displayName?: PlaceDisplayName;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
}
interface SearchTextResponse {
  places?: Place[];
  nextPageToken?: string;
}

const FIELD_MASK = [
  "places.displayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

async function searchTextPage(
  apiKey: string,
  textQuery: string,
  pageToken?: string,
): Promise<SearchTextResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as SearchTextResponse;
}

function describe(p: Place): string | null {
  const bits: string[] = [];
  if (p.formattedAddress) bits.push(p.formattedAddress);
  if (typeof p.rating === "number") {
    bits.push(`★${p.rating}${p.userRatingCount ? ` (${p.userRatingCount})` : ""}`);
  }
  return bits.length ? bits.join(" · ") : null;
}

export async function discoverFromGoogleMaps(spec: SearchSpec): Promise<BusinessCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[googlemaps] GOOGLE_PLACES_API_KEY not set — skipping Google Maps channel");
    return [];
  }

  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  const textQuery = loc ? `${n} in ${loc}` : n;
  const label = loc ? `${n} in ${loc}` : n;

  const out: BusinessCandidate[] = [];
  const domainsSeen = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let data: SearchTextResponse;
    try {
      data = await searchTextPage(apiKey, textQuery, pageToken);
    } catch (err) {
      console.error(`[googlemaps] ${(err as Error).message}`);
      break;
    }

    for (const p of data.places ?? []) {
      // Without a website we can't audit/pitch SEO — skip.
      if (!p.websiteUri) continue;
      const host = hostFromUrl(p.websiteUri);
      if (!host || isAggregator(host) || isMicrosite(host) || domainsSeen.has(host)) continue;
      domainsSeen.add(host);
      out.push({
        name: p.displayName?.text || pickName(undefined, host),
        website: `https://${host}`,
        domain: host,
        description: describe(p),
        query: label,
        channel: "googlemaps",
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}
