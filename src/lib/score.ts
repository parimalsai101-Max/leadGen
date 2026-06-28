import type { Outreach, SeoAudit } from "@/lib/types";

// Scores an SEO lead 0-100. A great lead is one that (a) clearly needs SEO help
// and (b) we can actually reach. Combines opportunity with reachability.

export interface ScoreInput {
  seo: SeoAudit | null;
  outreach: Outreach | null;
}

export function scoreLead(input: ScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. SEO opportunity (they need us) — up to 60 pts.
  if (input.seo) {
    const opp = Math.round((input.seo.opportunityScore / 100) * 60);
    if (opp > 0) {
      score += opp;
      const n = input.seo.issues.length;
      reasons.push(`${n} SEO issue${n === 1 ? "" : "s"} to pitch (+${opp})`);
    } else {
      reasons.push("Clean SEO — weaker pitch (+0)");
    }
  }

  // 2. Reachability (we can contact them) — up to 35 pts.
  const o = input.outreach;
  if (o) {
    let reach = 0;
    if (o.emails.length) reach += 18;
    if (o.phones.length) reach += 10;
    if (o.socials.length) reach += 4;
    if (o.people.length) reach += 3;
    reach = Math.min(35, reach);
    if (reach > 0) {
      score += reach;
      reasons.push(
        `reachable: ${o.emails.length} email / ${o.phones.length} phone / ${o.socials.length} social (+${reach})`,
      );
    } else {
      reasons.push("no contact channel found (+0)");
    }
  }

  // 3. Live site bonus — up to 5 pts (a reachable, working site = actionable).
  if (input.seo && (!input.seo.statusCode || input.seo.statusCode < 400)) {
    score += 5;
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}
