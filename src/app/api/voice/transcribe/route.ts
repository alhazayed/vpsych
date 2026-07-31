import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  azureSpeechLocale,
  hasAzureSpeech,
  normalizeSpeechLocale,
} from "@/lib/voice/config";
import { rateLimit } from "@/lib/rate-limit";

async function transcribeAzure(
  audio: Blob,
  locale: string,
): Promise<{ transcript: string } | { error: string; status: number }> {
  const key = process.env.AZURE_SPEECH_KEY!;
  const region = process.env.AZURE_SPEECH_REGION!;
  const language = azureSpeechLocale(normalizeSpeechLocale(locale));
  const contentType = audio.type || "audio/wav";

  const url = new URL(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
  );
  url.searchParams.set("language", language);
  url.searchParams.set("format", "simple");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: audio,
  });

  if (!res.ok) {
    const detail = await res.text();
    return {
      error: `Azure Speech failed (${res.status}): ${detail.slice(0, 400)}`,
      status: 502,
    };
  }

  const json = (await res.json()) as {
    RecognitionStatus?: string;
    DisplayText?: string;
  };

  if (json.RecognitionStatus && json.RecognitionStatus !== "Success") {
    return {
      error: `Azure Speech status: ${json.RecognitionStatus}`,
      status: 422,
    };
  }

  return { transcript: json.DisplayText?.trim() ?? "" };
}

async function transcribeDeepgram(
  audio: Blob,
): Promise<{ transcript: string } | { error: string; status: number }> {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    return {
      error:
        "Server STT not configured. Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (preferred) or DEEPGRAM_API_KEY.",
      status: 501,
    };
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
    const detail = await dgRes.text();
    return { error: `Deepgram transcription failed: ${detail}`, status: 502 };
  }

  const json = (await dgRes.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const transcript =
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  return { transcript };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`stt:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  const locale = String(form.get("locale") ?? "en");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "No audio provided." },
      { status: 400 },
    );
  }

  // Prefer Azure AI Speech; fall back to Deepgram if configured.
  if (hasAzureSpeech()) {
    const result = await transcribeAzure(audio, locale);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: "AZURE_STT_FAILED" },
        { status: result.status },
      );
    }
    return NextResponse.json({
      transcript: result.transcript,
      provider: "azure",
      locale: azureSpeechLocale(normalizeSpeechLocale(locale)),
    });
  }

  const dg = await transcribeDeepgram(audio);
  if ("error" in dg) {
    return NextResponse.json(
      {
        error: dg.error,
        code: "STT_UNAVAILABLE",
      },
      { status: dg.status },
    );
  }

  return NextResponse.json({
    transcript: dg.transcript,
    provider: "deepgram",
  });
}
