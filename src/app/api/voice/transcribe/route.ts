import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const audio = form.get("audio");

  // Prefer client-side Web Speech API. This endpoint accepts optional audio
  // and returns a clear message if no STT provider is configured.
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "No audio provided. Use browser speech recognition." },
      { status: 400 },
    );
  }

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    return NextResponse.json(
      {
        error:
          "Server STT not configured. Enable browser speech recognition or set DEEPGRAM_API_KEY.",
        code: "STT_UNAVAILABLE",
      },
      { status: 501 },
    );
  }

  const dgRes = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramKey}`,
        "Content-Type": audio.type || "audio/webm",
      },
      body: audio,
    },
  );

  if (!dgRes.ok) {
    return NextResponse.json(
      { error: "Deepgram transcription failed" },
      { status: 502 },
    );
  }

  const json = (await dgRes.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const transcript =
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

  return NextResponse.json({ transcript });
}
