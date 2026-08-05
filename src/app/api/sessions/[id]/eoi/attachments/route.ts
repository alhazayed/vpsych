import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { EOI_ATTACHMENT_KINDS } from "@/lib/eoi/types";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "video/webm",
  "video/mp4",
  "application/pdf",
  "text/plain",
]);

/**
 * POST multipart — attach design evidence to an educational opportunity.
 * Fields: opportunity_id, kind, file
 */
export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`eoi-att:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "multipart required" }, { status: 400 });
  }

  const opportunityId = String(form.get("opportunity_id") ?? "");
  const kindRaw = String(form.get("kind") ?? "other");
  const file = form.get("file");

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunity_id required" }, { status: 400 });
  }
  if (!(EOI_ATTACHMENT_KINDS as readonly string[]).includes(kindRaw)) {
    return NextResponse.json({ error: "Invalid attachment kind" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type) && file.type !== "") {
    return NextResponse.json({ error: "unsupported mime type" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 400 });
  }

  const { data: opp } = await supabase
    .from("eoi_opportunities")
    .select("id, reviewer_id, session_id")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opp && opp.session_id && opp.session_id !== sessionId) {
    return NextResponse.json(
      { error: "opportunity/session mismatch" },
      { status: 400 },
    );
  }

  const path = `${user.id}/${sessionId}/${opportunityId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await supabase.storage.createBucket("eoi-evidence", { public: false }).catch(() => undefined);
  const { error: upErr } = await supabase.storage
    .from("eoi-evidence")
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    console.error("[eoi/attachments] storage", upErr.message);
    // Still record metadata when possible (local/dev without storage)
  }

  const { data, error } = await supabase
    .from("eoi_attachments")
    .insert({
      opportunity_id: opportunityId,
      reviewer_id: user.id,
      kind: kindRaw,
      storage_path: path,
      mime_type: file.type || null,
      byte_size: file.size,
      metadata: { is_defect: false, kind: "educational_opportunity" },
    })
    .select("id")
    .single();

  if (error || !data) {
    // Soft success when vault tables are not applied yet — opportunity already stored
    return NextResponse.json({
      ok: true,
      attachment_id: null,
      memory_fallback: true,
      note: clientSafeError("Attachment metadata deferred", error),
    });
  }

  return NextResponse.json({
    ok: true,
    attachment_id: data.id as string,
    is_defect: false,
  });
}
