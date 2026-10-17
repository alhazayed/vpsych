"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

export function AdminSupervisorPanel() {
  const t = useTranslations("admin.supervisorPage");
  const tOps = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    supervisor_version?: string;
    ownership?: string;
    skill_catalog?: Array<{ id: string; label: string; weight: number; category: string }>;
    n_bundles?: number;
    disclaimer?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/supervisor");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? tOps("loadFailed"));
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(tOps("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tOps]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {tOps("loading")}
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {t("version", { version: data.supervisor_version ?? "" })}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface)]">
          {localizeOpsText(tText, data.ownership)}
        </p>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.disclaimer)}
        </p>
        <p className="mt-4 text-sm">
          {t("bundles", { count: data.n_bundles ?? 0 })}
        </p>
      </section>
      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("skillCatalogue")}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">{t("colSkill")}</th>
                <th className="py-2 pe-4 font-medium">{t("colCategory")}</th>
                <th className="py-2 font-medium">{t("colWeight")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.skill_catalog ?? []).map((s) => (
                <tr key={s.id} className="border-b border-[var(--outline-variant)]">
                  <td className="py-2 pe-4">
                    {t.has(`skills.${s.id}`) ? t(`skills.${s.id}`) : s.label}
                  </td>
                  <td className="py-2 pe-4">
                    {codeLabel(t, "categories", s.category)}
                  </td>
                  <td className="py-2 tabular-nums">{s.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
