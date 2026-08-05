import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

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
]);

/**
 * POST multipart — attach evidence to a flag.
 * Fields: flag_id, kind, file; optional transcript for audio.
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

  const limited = await rateLimit(`cqi-att:${user.id}`, 30, 60 * 60 * 1000);
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

  const flagId = String(form.get("flag_id") ?? "");
  const kind = String(form.get("kind") ?? "other");
  const transcript = form.get("transcript");
  const file = form.get("file");

  if (!flagId) {
    return NextResponse.json({ error: "flag_id required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "unsupported mime type" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 400 });
  }

  // Verify flag ownership / admin
  const { data: flag } = await supabase
    .from("cqi_flags")
    .select("id, reviewer_id, session_id")
    .eq("id", flagId)
    .maybeSingle();

  if (flag && flag.session_id && flag.session_id !== sessionId) {
    return NextResponse.json({ error: "flag/session mismatch" }, { status: 400 });
  }

  const path = `${user.id}/${sessionId}/${flagId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("cqi-evidence")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (upErr) {
    return NextResponse.json(
      { error: clientSafeError("Upload failed", upErr) },
      { status: 500 },
    );
  }

  let audioTranscript: string | null =
    typeof transcript === "string" ? transcript : null;

  // Best-effort STT for audio when transcript not provided
  if (!audioTranscript && file.type.startsWith("audio/") && process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const tr = await openai.audio.transcriptions.create({
        file: new File([bytes], file.name, { type: file.type }),
        model: "whisper-1",
      });
      audioTranscript = tr.text ?? null;
    } catch {
      audioTranscript = null;
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("cqi_attachments")
    .insert({
      flag_id: flagId,
      reviewer_id: user.id,
      kind,
      storage_path: path,
      mime_type: file.type,
      byte_size: file.size,
      transcript: audioTranscript,
      metadata: { session_id: sessionId, original_name: file.name },
    })
    .select("id, storage_path, transcript, kind")
    .single();

  if (insErr || !row) {
    return NextResponse.json(
      { error: clientSafeError("Failed to register attachment", insErr) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, attachment: row });
}
