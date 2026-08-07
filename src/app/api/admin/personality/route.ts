import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import {
  getBuiltinPersonality,
  listBuiltinPersonalitySlugs,
  loadAvatarHumanPersonalityMap,
  resolveHumanPersonality,
  saveHumanPersonalityProfile,
  validateHumanPersonality,
} from "@/lib/personality-engine";
import type { Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

/** Admin: list avatars + resolved human personality profiles. */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const limited = await rateLimit(
    `admin-personality-list:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: avatars, error } = await supabase
    .from("avatars")
    .select(
      "id, name, slug, disorder, age, gender, is_active, human_personality, personalities, schema_version",
    )
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Failed to list personalities", error) },
      { status: 500 },
    );
  }

  const rows = ((avatars as Avatar[] | null) ?? []).map((avatar) => {
    const locale =
      avatar.default_locale ??
      (avatar.personalities && Object.keys(avatar.personalities)[0]) ??
      "en-US";
    const resolved = resolveHumanPersonality({ avatar, locale });
    return {
      id: avatar.id,
      name: avatar.name,
      slug: avatar.slug,
      disorder: avatar.disorder,
      is_active: avatar.is_active,
      locales: Object.keys(avatar.human_personality ?? {}).length
        ? Object.keys(avatar.human_personality ?? {})
        : avatar.slug && listBuiltinPersonalitySlugs().includes(avatar.slug)
          ? Object.keys(
              // builtin locales
              Object.fromEntries(
                ["en-US", "ar-JO"]
                  .map((l) => [l, getBuiltinPersonality(avatar.slug!, l)])
                  .filter(([, p]) => p),
              ),
            )
          : [locale],
      profile: resolved,
    };
  });

  return NextResponse.json({
    avatars: rows,
    builtinSlugs: listBuiltinPersonalitySlugs(),
  });
}

/** Admin: save a locale human personality profile. */
export async function PUT(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const limited = await rateLimit(
    `admin-personality-save:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    avatarId?: string;
    locale?: string;
    profile?: unknown;
  };

  if (!body.avatarId || !body.locale || body.profile == null) {
    return NextResponse.json(
      { error: "avatarId, locale, and profile are required" },
      { status: 400 },
    );
  }

  const validated = validateHumanPersonality(body.profile);
  if (!validated.ok) {
    return NextResponse.json(
      {
        error: "Invalid personality profile",
        issues: validated.issues,
      },
      { status: 400 },
    );
  }

  const result = await saveHumanPersonalityProfile(supabase, {
    avatarId: body.avatarId,
    locale: body.locale,
    profile: validated.profile,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: clientSafeError("Failed to save personality", result.error),
        issues: result.issues,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, map: result.map });
}

/** Admin: validate + preview formatted prompt block without saving. */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-personality-preview:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    avatarId?: string;
    locale?: string;
    profile?: unknown;
    action?: "preview" | "load";
  };

  if (body.action === "load" && body.avatarId) {
    const map = await loadAvatarHumanPersonalityMap(auth.supabase, body.avatarId);
    const { data: avatar } = await auth.supabase
      .from("avatars")
      .select("*")
      .eq("id", body.avatarId)
      .maybeSingle();
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }
    const locale = body.locale ?? "en-US";
    const profile = resolveHumanPersonality({
      avatar: avatar as Avatar,
      locale,
    });
    return NextResponse.json({ map, profile, locale });
  }

  const validated = validateHumanPersonality(body.profile);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "Invalid personality profile", issues: validated.issues },
      { status: 400 },
    );
  }

  const { formatHumanPersonalityForPrompt, formatHumanPersonalityPerTurnCue } =
    await import("@/lib/personality-engine");

  return NextResponse.json({
    ok: true,
    profile: validated.profile,
    promptBlock: formatHumanPersonalityForPrompt(validated.profile),
    perTurnCue: formatHumanPersonalityPerTurnCue(validated.profile),
  });
}
