import type { SessionMessage as AppSessionMessage } from "@/lib/types";
import type { SessionSpeechLocale } from "@/lib/voice/config";

export type { SessionSpeechLocale };

/** Message shape returned by the conversation message API (includes timestamps). */
export type SessionMessage = AppSessionMessage;
