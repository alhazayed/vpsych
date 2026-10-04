/**
 * Client helper for OpenAI Speech Recognition against /api/voice/transcribe.
 * Preserves the Voice Session upload contract.
 */
import {
  buildTranscribeFormData,
  parseTranscribeResponse,
} from "@/lib/voice/stt";
import {
  isEmptyRecording,
  voiceLog,
  wavDurationMs,
} from "@/lib/voice/voice-diagnostics";

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
  const blobType = params.audio.type || "";
  voiceLog("STT", "blob_ready", {
    blob_size: params.audio.size,
    blob_type: blobType || "(none)",
    blob_duration_ms: blobType.includes("wav")
      ? wavDurationMs(params.audio.size)
      : undefined,
  });
  // Never upload a header-only WAV: the route would 400 and the turn would
  // look like a silent failure. Report it as an explicit empty recording.
  if (isEmptyRecording(params.audio)) {
    voiceLog("STT", "stt_error", { code: "EMPTY_RECORDING" });
    return {
      ok: false,
      error: "The recording was empty.",
      code: "EMPTY_RECORDING",
      status: 0,
      unavailable: false,
    };
  }

  const form = buildTranscribeFormData({
    audio: params.audio,
    locale: params.locale,
  });

  try {
    voiceLog("STT", "stt_request_started", { locale: params.locale });
    const res = await fetch("/api/voice/transcribe", {
      method: "POST",
      body: form,
      signal: params.signal,
    });
    const raw = await res.json().catch(() => ({}));
    const data = parseTranscribeResponse(raw);
    voiceLog("STT", "stt_response_status", { status: res.status });

    if (!res.ok) {
      voiceLog("STT", "stt_error", { status: res.status, code: data.code });
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

    voiceLog("STT", "stt_transcript_length", {
      length: data.transcript.length,
    });
    return {
      ok: true,
      transcript: data.transcript,
      provider: data.provider ?? "openai",
    };
  } catch (error) {
    if (!params.signal?.aborted) {
      voiceLog("STT", "stt_error", { code: "NETWORK" });
    }
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Network error during transcription.",
      code: params.signal?.aborted ? "ABORTED" : "NETWORK",
      status: 0,
      unavailable: false,
    };
  }
}
