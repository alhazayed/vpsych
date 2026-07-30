import Image from "next/image";
import { requireProfile } from "@/lib/auth";
import type { Avatar } from "@/lib/types";
import { StartSessionButton } from "@/components/StartSessionButton";

export default async function AvatarsPage() {
  const { supabase, profile } = await requireProfile();
  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, portrait_url, ideal_guidelines, is_active",
    )
    .eq("is_active", true)
    .order("name");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-10 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
          Welcome, {profile.display_name}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Choose a patient avatar
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Each avatar is preset with a disorder and ideal-session guidelines.
          Sessions are voice-first and capped at 40 minutes. Reports go to
          admins only.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {(avatars as Omit<Avatar, "persona_prompt" | "rubric" | "created_at" | "updated_at">[] | null)?.map(
          (avatar) => (
            <article
              key={avatar.id}
              className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]/80"
            >
              <div className="relative h-48 bg-[var(--wash)]">
                {avatar.portrait_url && (
                  <Image
                    src={avatar.portrait_url}
                    alt={avatar.name}
                    fill
                    className="object-cover object-top"
                  />
                )}
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl">
                    {avatar.name}
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    {avatar.disorder}
                    {avatar.age ? ` · ${avatar.age}` : ""}
                    {avatar.gender ? ` · ${avatar.gender}` : ""}
                  </p>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {(avatar.ideal_guidelines?.session_goals ?? [])
                    .slice(0, 3)
                    .map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                </ul>
                <StartSessionButton avatarId={avatar.id} />
              </div>
            </article>
          ),
        )}
      </div>
    </main>
  );
}
