import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: enable / disable a voice profile.
 * Body: { is_active: boolean }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    is_active?: boolean;
  };
  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active boolean required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("voice_profiles")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ voiceProfile: data });
}
