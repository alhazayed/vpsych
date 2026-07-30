import { requireAdmin } from "@/lib/auth";
import type { Avatar } from "@/lib/types";

export default async function AdminAvatarsPage() {
  const { supabase } = await requireAdmin();
  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, is_active, ideal_guidelines, rubric",
    )
    .order("name");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Avatar presets
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Presets include disorder persona prompts and ideal-session guidelines.
        Editing UI can expand in a later phase; manage seed data via Supabase
        for now.
      </p>
      <ul className="mt-8 space-y-4">
        {(avatars as Pick<
          Avatar,
          | "id"
          | "name"
          | "disorder"
          | "age"
          | "gender"
          | "is_active"
          | "ideal_guidelines"
          | "rubric"
        >[] | null)?.map((avatar) => (
          <li
            key={avatar.id}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                {avatar.name}
              </h2>
              <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                {avatar.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {avatar.disorder}
              {avatar.age ? ` · ${avatar.age}` : ""}
              {avatar.gender ? ` · ${avatar.gender}` : ""}
            </p>
            <h3 className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Ideal session goals
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {(avatar.ideal_guidelines?.session_goals ?? []).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <h3 className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Rubric
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              {(avatar.rubric ?? []).map((r) => (
                <li key={r.id}>
                  {r.label} (max {r.max}, weight {r.weight})
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
