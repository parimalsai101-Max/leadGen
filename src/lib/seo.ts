import type { SeoAudit } from "@/lib/types";

// Derives an on-page SEO audit from a crawl4ai scrape (metadata + markdown).
// The `issues` list is literally your outreach talking points.

interface ScrapeLike {
  markdown?: string;
  metadata?: Record<string, unknown>;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function auditSeo(doc: ScrapeLike, requestedUrl: string): SeoAudit {
  const md = doc.metadata ?? {};
  const finalUrl = str(md.url) ?? str(md.sourceURL) ?? requestedUrl;
  const httpsOk = finalUrl.startsWith("https://");
  const statusCode = typeof md.statusCode === "number" ? md.statusCode : null;

  const title = str(md.title) ?? str(md.ogTitle);
  const titleLength = title?.length ?? 0;
  const description = str(md.description) ?? str(md.ogDescription);
  const descriptionLength = description?.length ?? 0;

  const markdown = doc.markdown ?? "";
  const hasH1 = /(^|\n)#\s+\S/.test(markdown);
  const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : 0;

  const hasOgTitle = !!str(md.ogTitle);
  const hasOgImage = !!str(md.ogImage);
  const hasFavicon = !!str(md.favicon);

  // Each issue is a concrete, pitchable problem. Weighted toward what moves rankings.
  const issues: string[] = [];
  let opp = 0;

  if (!httpsOk) { issues.push("Site not served over HTTPS"); opp += 20; }
  if (!title) { issues.push("Missing <title> tag"); opp += 20; }
  else if (titleLength < 30) { issues.push(`Title too short (${titleLength} chars)`); opp += 8; }
  else if (titleLength > 60) { issues.push(`Title too long (${titleLength} chars, truncates in search)`); opp += 6; }

  if (!description) { issues.push("Missing meta description"); opp += 18; }
  else if (descriptionLength < 70) { issues.push(`Meta description too short (${descriptionLength} chars)`); opp += 8; }
  else if (descriptionLength > 160) { issues.push(`Meta description too long (${descriptionLength} chars)`); opp += 5; }

  if (!hasH1) { issues.push("No H1 heading on the page"); opp += 12; }
  if (!hasOgTitle || !hasOgImage) { issues.push("Missing Open Graph tags (poor social sharing previews)"); opp += 8; }
  if (!hasFavicon) { issues.push("No favicon detected"); opp += 3; }
  if (wordCount > 0 && wordCount < 250) { issues.push(`Thin content (~${wordCount} words on homepage)`); opp += 10; }
  if (statusCode && statusCode >= 400) { issues.push(`Homepage returned HTTP ${statusCode}`); opp += 15; }

  return {
    finalUrl, httpsOk, statusCode,
    title, titleLength, description, descriptionLength,
    hasH1, hasOgTitle, hasOgImage, hasFavicon, wordCount,
    issues,
    opportunityScore: Math.min(100, opp),
  };
}
