import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import type { Avatar } from "@/lib/types";
import { StartSessionButton } from "@/components/StartSessionButton";

export default async function AvatarsPage() {
  const { supabase, profile } = await requireProfile();
  const t = await getTranslations("avatars");
  const tCommon = await getTranslations("common");
  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, portrait_url, ideal_guidelines, is_active",
    )
    .eq("is_active", true)
    .order("name");

  const list =
    (avatars as
      | Omit<
          Avatar,
          "persona_prompt" | "rubric" | "created_at" | "updated_at"
        >[]
      | null) ?? [];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <p className="mb-1 text-sm font-medium uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
          {t("welcomeBack")}
        </p>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)] md:text-[32px] md:leading-10">
          {profile.display_name}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--on-surface-variant)]">
          {t("intro")}
        </p>
      </section>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {t("count", {
              count: list.length,
              persona: list.length === 1 ? t("persona") : t("personas"),
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((avatar, index) => (
          <article
            key={avatar.id}
            className="clinical-card clinical-card-interactive fade-in-up overflow-hidden"
            style={{ animationDelay: `${0.05 * (index + 1)}s` }}
          >
            <div className="relative h-48 bg-[var(--surface-container)]">
              {avatar.portrait_url ? (
                <Image
                  src={avatar.portrait_url}
                  alt={avatar.name}
                  fill
                  className="object-cover object-top"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-[family-name:var(--font-headline)] text-4xl font-bold text-[var(--primary)]">
                  {avatar.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                    {avatar.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {avatar.disorder}
                    {avatar.age ? ` · ${avatar.age}` : ""}
                    {avatar.gender ? ` · ${avatar.gender}` : ""}
                  </p>
                </div>
                <span className="status-chip status-chip-active">
                  {tCommon("active")}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
                {(avatar.ideal_guidelines?.session_goals ?? [])
                  .slice(0, 3)
                  .map((goal) => (
                    <li key={goal} className="flex gap-2">
                      <span className="material-symbols-outlined mt-0.5 text-[18px] text-[var(--primary)]">
                        check_circle
                      </span>
                      <span>{goal}</span>
                    </li>
                  ))}
              </ul>
              <StartSessionButton avatarId={avatar.id} />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
