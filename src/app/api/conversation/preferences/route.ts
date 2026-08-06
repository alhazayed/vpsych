import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import {
  normalizeVoicePreferences,
  type VoiceConversationPreferences,
} from "@/lib/conversation";
import { rateLimit } from "@/lib/rate-limit";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation/feature-flag";

export async function GET(request: Request) {
  if (!isHandsFreeTherapyEnabled()) {
    return NextResponse.json({ error: "HFTE disabled" }, { status: 404 });
  }

  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `hfte-prefs:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("voice_conversation_preferences")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }

  const preferences = normalizeVoicePreferences(
    data?.voice_conversation_preferences,
  );
  return NextResponse.json({ preferences, enabled: true });
}

export async function PATCH(request: Request) {
  if (!isHandsFreeTherapyEnabled()) {
    return NextResponse.json({ error: "HFTE disabled" }, { status: 404 });
  }

  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `hfte-prefs:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: Partial<VoiceConversationPreferences>;
  try {
    body = (await request.json()) as Partial<VoiceConversationPreferences>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await auth.supabase
    .from("profiles")
    .select("voice_conversation_preferences")
    .eq("id", auth.user.id)
    .maybeSingle();

  const preferences = normalizeVoicePreferences({
    ...normalizeVoicePreferences(existing?.voice_conversation_preferences),
    ...body,
  });

  const { error } = await auth.supabase
    .from("profiles")
    .update({ voice_conversation_preferences: preferences })
    .eq("id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json({ preferences });
}
