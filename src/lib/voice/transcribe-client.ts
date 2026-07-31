/**
 * Client helper for OpenAI Speech Recognition against /api/voice/transcribe.
 * Preserves the Voice Session upload contract.
 */
import {
  buildTranscribeFormData,
  parseTranscribeResponse,
} from "@/lib/voice/stt";

export type ClientTranscribeResult =
  | {
      ok: true;
      transcript: string;
      provider?: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      status: number;
      unavailable: boolean;
    };

export async function transcribeWithOpenAI(params: {
  audio: Blob;
  /** session.language (en / ar / BCP-47). */
  locale: string;
  signal?: AbortSignal;
}): Promise<ClientTranscribeResult> {
  const form = buildTranscribeFormData({
    audio: params.audio,
    locale: params.locale,
  });

  try {
    const res = await fetch("/api/voice/transcribe", {
      method: "POST",
      body: form,
      signal: params.signal,
    });
    const raw = await res.json().catch(() => ({}));
    const data = parseTranscribeResponse(raw);

    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Transcription failed.",
        code: data.code,
        status: res.status,
        unavailable:
          data.code === "STT_UNAVAILABLE" ||
          res.status === 501 ||
          data.code === "OPENAI_CONFIG",
      };
    }

    return {
      ok: true,
      transcript: data.transcript,
      provider: data.provider ?? "openai",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Network error during transcription.",
      status: 0,
      unavailable: false,
    };
  }
}
