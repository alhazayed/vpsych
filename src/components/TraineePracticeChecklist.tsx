import { getTranslations } from "next-intl/server";
import type { TraineeChecklistGroup } from "@/lib/session-practice";

/**
 * Trainee view: practices done or missed in this session. No scores, counts or
 * narrative; the performance report stays admin-only. Practice labels are
 * shared with the admin Session practice panel.
 */
export async function TraineePracticeChecklist({
  groups,
}: {
  groups: TraineeChecklistGroup[];
}) {
  const t = await getTranslations("sessions.complete.checklist");
  const tPractice = await getTranslations("admin.reportDetail.practice");

  return (
    <section
      className="clinical-card mb-4 p-5 fade-in-up"
      aria-labelledby="trainee-checklist-title"
    >
      <h2
        id="trainee-checklist-title"
        className="font-[family-name:var(--font-headline)] text-lg font-semibold"
      >
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        {t("subtitle")}
      </p>

      <div className="mt-4 space-y-4">
        {groups.map((g) => (
          <div key={g.group}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--on-surface)]">
              {tPractice(`groups.${g.group}`)}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {g.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      item.done
                        ? "text-[var(--primary)]"
                        : "text-[var(--on-surface-variant)]"
                    }`}
                    aria-hidden
                  >
                    {item.done ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className="text-[var(--on-surface)]">
                    {tPractice(`checks.${item.id}`)}
                    <span className="sr-only">
                      {" "}
                      {item.done ? t("done") : t("missed")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[var(--on-surface-variant)]">
        {t("note")}
      </p>
    </section>
  );
}
