/**
 * Mission 30 — Independent Public Launch Board checklist.
 * Statuses reflect production truth + code readiness on the Phase 6 stack.
 */

export type ChecklistStatus = "pass" | "partial" | "fail" | "n/a";

export type ChecklistItem = {
  id: string;
  category:
    | "seo"
    | "aeo"
    | "geo"
    | "brand"
    | "marketing"
    | "documentation"
    | "support"
    | "legal"
    | "analytics"
    | "consent"
    | "email"
    | "domains"
    | "ssl"
    | "monitoring"
    | "performance"
    | "verification"
    | "social"
    | "release";
  label: string;
  status: ChecklistStatus;
  evidence: string;
  weight: number;
};

/** Board assessment as of 2026-08-03 (production = main @ Mission 03 tip). */
export const PUBLIC_LAUNCH_CHECKLIST: ChecklistItem[] = [
  {
    id: "seo-stack",
    category: "seo",
    label: "Technical SEO (robots, sitemap, canonicals) on Phase 6 branch",
    status: "pass",
    evidence: "M26 docs/TECHNICAL_SEO_CERTIFICATION.md score 88",
    weight: 4,
  },
  {
    id: "seo-prod",
    category: "seo",
    label: "Technical SEO live on production",
    status: "fail",
    evidence:
      "https://vpsych.vercel.app/robots.txt and /about|/terms return 307 soft-gate (main lacks M26–M29)",
    weight: 8,
  },
  {
    id: "aeo",
    category: "aeo",
    label: "AEO surfaces (llms.txt, FAQ, knowledge graph)",
    status: "partial",
    evidence: "Present on Phase 6 branch (M27); not on production main",
    weight: 4,
  },
  {
    id: "geo",
    category: "geo",
    label: "GEO citation surfaces (research, citations.json)",
    status: "partial",
    evidence: "Present on Phase 6 branch (M28); not on production main",
    weight: 4,
  },
  {
    id: "brand",
    category: "brand",
    label: "Brand & conversion (legal, help, pricing, consent UI)",
    status: "partial",
    evidence: "Present on Phase 6 branch (M29 score 86); not on production main",
    weight: 5,
  },
  {
    id: "marketing-pages",
    category: "marketing",
    label: "Marketing landing + pricing + CTAs",
    status: "partial",
    evidence: "Landing/pricing remediations on branch; production still Mission 03 funnel",
    weight: 4,
  },
  {
    id: "og",
    category: "social",
    label: "Open Graph / Twitter preview metadata",
    status: "pass",
    evidence: "src/app/layout.tsx metadataBase + openGraph + twitter cards",
    weight: 3,
  },
  {
    id: "gsc",
    category: "verification",
    label: "Google Search Console ready",
    status: "partial",
    evidence:
      "Verification meta env NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION wired; property not verified / sitemap not submitted in prod",
    weight: 5,
  },
  {
    id: "bing",
    category: "verification",
    label: "Bing Webmaster ready",
    status: "partial",
    evidence:
      "Verification meta env NEXT_PUBLIC_BING_SITE_VERIFICATION wired; not verified in prod",
    weight: 3,
  },
  {
    id: "ga4",
    category: "analytics",
    label: "Google Analytics (GA4) configured",
    status: "partial",
    evidence:
      "Consent-gated loader present; NEXT_PUBLIC_GA_MEASUREMENT_ID unset in deploy",
    weight: 5,
  },
  {
    id: "clarity",
    category: "analytics",
    label: "Microsoft Clarity configured",
    status: "partial",
    evidence:
      "Consent-gated loader present; NEXT_PUBLIC_CLARITY_PROJECT_ID unset",
    weight: 3,
  },
  {
    id: "meta-pixel",
    category: "analytics",
    label: "Meta Pixel (if applicable)",
    status: "n/a",
    evidence:
      "Optional consent-gated loader; enable via NEXT_PUBLIC_META_PIXEL_ID only if paid social runs",
    weight: 1,
  },
  {
    id: "linkedin",
    category: "analytics",
    label: "LinkedIn Insight (if applicable)",
    status: "n/a",
    evidence:
      "Optional consent-gated loader; enable via NEXT_PUBLIC_LINKEDIN_PARTNER_ID for B2B ads",
    weight: 1,
  },
  {
    id: "cookie",
    category: "consent",
    label: "Cookie consent gates optional analytics",
    status: "pass",
    evidence: "CookieConsent + AnalyticsScripts listen for analytics preference",
    weight: 5,
  },
  {
    id: "legal",
    category: "legal",
    label: "Terms + Privacy public pages",
    status: "partial",
    evidence: "/terms /privacy on Phase 6 branch; production 307",
    weight: 6,
  },
  {
    id: "support",
    category: "support",
    label: "Help Center + Contact",
    status: "partial",
    evidence: "/help /contact on branch; inbox hello@vpsych.app ops unconfirmed",
    weight: 4,
  },
  {
    id: "docs",
    category: "documentation",
    label: "Public documentation & release notes",
    status: "pass",
    evidence: "/release-notes + docs/RELEASE_NOTES.md + certification reports M26–M30",
    weight: 3,
  },
  {
    id: "email",
    category: "email",
    label: "Transactional email (signup / reset)",
    status: "partial",
    evidence:
      "Resend Auth hook in supabase/functions; RESEND_* not in .env.example until M30; production delivery unproven",
    weight: 5,
  },
  {
    id: "domains",
    category: "domains",
    label: "Canonical domain configured",
    status: "partial",
    evidence: "Default https://vpsych.vercel.app; custom apex domain not documented as live",
    weight: 3,
  },
  {
    id: "ssl",
    category: "ssl",
    label: "TLS / HSTS on production host",
    status: "pass",
    evidence: "Vercel HTTPS + Strict-Transport-Security max-age=63072000 observed",
    weight: 4,
  },
  {
    id: "monitoring",
    category: "monitoring",
    label: "Public monitoring / error tracking",
    status: "fail",
    evidence: "No Sentry; no public /api/health on this train; admin openai health only",
    weight: 5,
  },
  {
    id: "performance",
    category: "performance",
    label: "Performance / CWV launch bar",
    status: "partial",
    evidence: "M26 Lighthouse ~84 / weak LCP; M21 remediations not on this train",
    weight: 4,
  },
  {
    id: "release-train",
    category: "release",
    label: "Phase 6 merged to main / production",
    status: "fail",
    evidence: "main @ Mission 03; M26–M29 draft PRs unmerged; M25 executive board not approved",
    weight: 10,
  },
];

export function scoreChecklist(items: ChecklistItem[] = PUBLIC_LAUNCH_CHECKLIST) {
  let earned = 0;
  let possible = 0;
  for (const item of items) {
    if (item.status === "n/a") continue;
    possible += item.weight;
    if (item.status === "pass") earned += item.weight;
    else if (item.status === "partial") earned += item.weight * 0.45;
  }
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { score, earned, possible };
}

export function launchRecommendation(score: number): {
  verdict: "NOT READY" | "READY WITH RECOMMENDATIONS" | "READY FOR PUBLIC LAUNCH";
  symbol: "❌" | "⚠" | "✅";
  recommendation: string;
} {
  if (score >= 90) {
    return {
      verdict: "READY FOR PUBLIC LAUNCH",
      symbol: "✅",
      recommendation:
        "Announce publicly after a final production smoke test of auth email, sitemap submission, and support inbox.",
    };
  }
  if (score >= 75) {
    return {
      verdict: "READY WITH RECOMMENDATIONS",
      symbol: "⚠",
      recommendation:
        "Soft launch / waitlist only. Close production parity and analytics verification before broad marketing.",
    };
  }
  return {
    verdict: "NOT READY",
    symbol: "❌",
    recommendation:
      "Do not announce a public launch. Merge and deploy Phase 6 (M26–M29), verify webmaster + GA/Clarity with consent, prove auth email, and add baseline monitoring first.",
  };
}

export function buildLaunchReadinessDocument() {
  const { score } = scoreChecklist();
  const rec = launchRecommendation(score);
  return {
    mission: 30,
    title: "VPsych Public Launch Certification",
    assessedAt: "2026-08-03",
    overallLaunchScore: score,
    verdict: `${rec.symbol} ${rec.verdict}`,
    launchRecommendation: rec.recommendation,
    checklist: PUBLIC_LAUNCH_CHECKLIST,
    blockers: PUBLIC_LAUNCH_CHECKLIST.filter((i) => i.status === "fail").map(
      (i) => i.label,
    ),
  };
}
