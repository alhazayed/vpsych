import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  bpcToCsv,
  buildCvlResearchPackage,
  buildPublicationSkeleton,
  loadCvlCorpus,
  pythonAnalysisStub,
  rAnalysisStub,
  spssDictionary,
} from "@/lib/cvl";

export const dynamic = "force-dynamic";

/** GET — research export ?format=package|csv|json|spss|r|python|publication */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvl.export",
    resourceType: "cvl_export",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cvl-export:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "package";
  const includeArms = url.searchParams.get("unblind") === "1";
  const { corpus, source } = await loadCvlCorpus(auth.supabase);
  const {
    studies,
    assignments,
    bpc,
    hcf,
    education,
    longitudinal,
    cfl,
  } = corpus;

  if (format === "csv") {
    const allowArms =
      includeArms &&
      studies.length > 0 &&
      studies.every((s) =>
        ["analysis", "completed", "archived"].includes(s.status),
      );
    const csv = bpcToCsv(bpc, assignments, { include_arms: allowArms });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cvl-bpc.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "spss") {
    return new NextResponse(spssDictionary(), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cvl-spss.txt"',
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "r") {
    return new NextResponse(rAnalysisStub(), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cvl-analysis.R"',
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "python") {
    return new NextResponse(pythonAnalysisStub(), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cvl_analysis.py"',
        "Cache-Control": "no-store",
      },
    });
  }

  const pkg = buildCvlResearchPackage({
    studies,
    assignments,
    bpc,
    hcf,
    education,
    longitudinal,
    cfl,
    include_arms: includeArms,
  });

  if (format === "publication") {
    return NextResponse.json(
      {
        is_fabricated: false,
        source,
        manuscript: buildPublicationSkeleton(pkg),
        package_meta: {
          cvl_version: pkg.cvl_version,
          generated_at: pkg.generated_at,
          redacted_ratings_count: pkg.redacted_ratings_count,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ...pkg,
      source,
      excel_note:
        "Use CSV import into Excel/Sheets; no binary xlsx fabricated.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
