import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  VALIDATION_ACCESS_COOKIE,
  VALIDATION_ACCESS_MAX_AGE_SEC,
  accessCookieValueForCode,
  configuredInviteCodes,
  isValidAccessCookie,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/validation/invite";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `validation-invite:${ip}`;
}

function accessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDATION_ACCESS_MAX_AGE_SEC,
  };
}

/** Check whether the current browser already holds a valid invite cookie. */
export async function GET(request: Request) {
  const limited = await rateLimit(clientKey(request), 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${VALIDATION_ACCESS_COOKIE}=`));
  const value = match?.slice(VALIDATION_ACCESS_COOKIE.length + 1);
  const unlocked = isValidAccessCookie(value);

  return NextResponse.json(
    {
      unlocked,
      invitesConfigured: configuredInviteCodes().length > 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Redeem an invitation code and set the access cookie. */
export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request), 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  if (configuredInviteCodes().length === 0) {
    return NextResponse.json(
      { error: "Invitations are not available right now." },
      { status: 503 },
    );
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const code =
    typeof body.code === "string" ? normalizeInviteCode(body.code) : "";
  if (!code || code.length > 64) {
    return NextResponse.json(
      { error: "Enter a valid invitation code." },
      { status: 400 },
    );
  }

  if (!isValidInviteCode(code)) {
    return NextResponse.json(
      { error: "That invitation code is not recognized." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, unlocked: true });
  response.cookies.set(
    VALIDATION_ACCESS_COOKIE,
    accessCookieValueForCode(code),
    accessCookieOptions(),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
