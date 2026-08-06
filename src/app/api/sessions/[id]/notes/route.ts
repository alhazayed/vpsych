import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import type { NoteFormat } from "@/lib/therapy-room";

type Props = { params: Promise<{ id: string }> };

async function assertSessionOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("sessions")
    .select("id, therapist_id")
    .eq("id", sessionId)
    .maybeSingle();
  return data?.therapist_id === userId ? data : null;
}

function mapNote(n: {
  id: string;
  session_id: string;
  format: string;
  body: string;
  voice_url: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: n.id,
    sessionId: n.session_id,
    format: n.format,
    body: n.body,
    voiceUrl: n.voice_url,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

/** Canonical private notes API — session_private_notes table only. */
export async function GET(_request: Request, { params }: Props) {
  if (!isTherapyRoomModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`notes:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!(await assertSessionOwner(supabase, id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("session_private_notes")
    .select("id, session_id, format, body, voice_url, created_at, updated_at")
    .eq("session_id", id)
    .eq("therapist_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not load notes", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ notes: (data ?? []).map(mapNote) });
}

export async function POST(request: Request, { params }: Props) {
  if (!isTherapyRoomModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`notes-write:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!(await assertSessionOwner(supabase, id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    format?: NoteFormat;
    body?: string;
    voiceUrl?: string | null;
  };

  const format = body.format ?? "free";
  const text = typeof body.body === "string" ? body.body.slice(0, 20000) : "";

  const { data, error } = await supabase
    .from("session_private_notes")
    .insert({
      session_id: id,
      therapist_id: user.id,
      format,
      body: text,
      voice_url: body.voiceUrl ?? null,
    })
    .select("id, session_id, format, body, voice_url, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: clientSafeError("Could not save note", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ note: mapNote(data) });
}

export async function PATCH(request: Request, { params }: Props) {
  if (!isTherapyRoomModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`notes-write:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!(await assertSessionOwner(supabase, id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    noteId?: string;
    format?: NoteFormat;
    body?: string;
  };

  if (!body.noteId || typeof body.noteId !== "string") {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.body === "string") patch.body = body.body.slice(0, 20000);
  if (body.format) patch.format = body.format;

  const { data, error } = await supabase
    .from("session_private_notes")
    .update(patch)
    .eq("id", body.noteId)
    .eq("session_id", id)
    .eq("therapist_id", user.id)
    .select("id, session_id, format, body, voice_url, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not update note", error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ note: mapNote(data) });
}
