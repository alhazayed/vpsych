import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionReportReview } from "@/lib/types";

/** A review with its author's name when the reader may see it (RLS). */
export type ReviewWithAuthor = SessionReportReview & {
  reviewer: { display_name: string } | null;
};

/**
 * Reviews of the given sessions that the caller may read (RLS decides).
 * Returns `failed: true` instead of throwing: a report page must still show
 * the AI report when reviews cannot be loaded, and say so.
 */
export async function loadReportReviews(
  supabase: SupabaseClient,
  sessionIds: string[],
): Promise<{ reviews: ReviewWithAuthor[]; failed: boolean }> {
  if (sessionIds.length === 0) return { reviews: [], failed: false };
  const { data, error } = await supabase
    .from("session_report_reviews")
    .select(
      "id, session_id, reviewer_id, comment, adjusted_overall, flagged, created_at, updated_at, reviewer:profiles!session_report_reviews_reviewer_id_fkey(display_name)",
    )
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[supervisor-reviews] load failed", {
      sessions: sessionIds.length,
      error: error.message,
    });
    return { reviews: [], failed: true };
  }
  return { reviews: (data ?? []) as unknown as ReviewWithAuthor[], failed: false };
}

/** Groups reviews by session id. */
export function reviewsBySession(
  reviews: ReviewWithAuthor[],
): Map<string, ReviewWithAuthor[]> {
  const out = new Map<string, ReviewWithAuthor[]>();
  for (const r of reviews) {
    const list = out.get(r.session_id) ?? [];
    list.push(r);
    out.set(r.session_id, list);
  }
  return out;
}
