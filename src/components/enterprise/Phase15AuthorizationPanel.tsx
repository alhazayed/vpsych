"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type Gate = {
  id: string;
  label: string;
  status: string;
  evidence: string;
  blocks_ga: boolean;
};

type Check = {
  id: string;
  label: string;
  status: string;
  evidence: string;
};

type Payload = {
  cert_id?: string;
  package_version?: string;
  ownership?: string;
  cidp_status?: string;
  ga_status?: string;
  authorized_version?: string | null;
  board_recommendation?: string;
  disclaimer?: string;
  residual_risks?: string[];
  authorization?: {
    decision?: string;
    motion?: string;
    pass_count?: number;
    fail_or_open_count?: number;
    board_gates?: Gate[];
  };
  pilot_completion?: {
    institutions?: number;
    objectives_met?: boolean;
    simulations_completed?: number;
    assessments_completed?: number;
    mean_user_satisfaction?: number;
  };
  certifications?: Record<
    string,
    { overall?: string; checks?: Check[]; workstream?: string }
  >;
};

/** `"RISK-P14-01: description"` → id and description, translated separately. */
function splitResidualRisk(text: string): { id: string; description: string } {
  const at = text.indexOf(": ");
  return at > 0
    ? { id: text.slice(0, at), description: text.slice(at + 2) }
    : { id: "", description: text };
}

export function Phase15AuthorizationPanel() {
  const t = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ops/phase15");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? t("loadFailed"));
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(t("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {t("loadingPhase", { phase: 15 })}
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  const certEntries = Object.entries(data.certifications ?? {}).filter(
    ([key]) => key !== "generated_at",
  );

  return (
    <div className="space-y-10 border-t border-[var(--outline-variant)] pt-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {data.cert_id} · v{data.package_version}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("phase15Title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.ownership)}
        </p>
        <p className="mt-2 text-sm">
          {t("cidpStatus", {
            status: codeLabel(t, "status", data.cidp_status ?? "GO"),
          })}{" "}
          ·{" "}
          {t("gaStatus", {
            status: codeLabel(t, "status", data.ga_status ?? "NO-GO"),
          })}{" "}
          ·{" "}
          {t("authorizedVersion", {
            version: data.authorized_version ?? t("none"),
          })}{" "}
          · {t("gatesPassed", { count: data.authorization?.pass_count ?? 0 })} ·{" "}
          {t("gatesOpen", {
            count: data.authorization?.fail_or_open_count ?? 0,
          })}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface)]">
          {localizeOpsText(
            tText,
            data.board_recommendation ?? data.authorization?.decision,
          )}
        </p>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.authorization?.motion)}
        </p>
        {data.disclaimer ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {localizeOpsText(tText, data.disclaimer)}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("boardGates")}
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">{t("colGate")}</th>
                <th className="py-2 pe-4 font-medium">{t("colStatus")}</th>
                <th className="py-2 font-medium">{t("colEvidence")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.authorization?.board_gates ?? []).map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[var(--outline-variant)]/60"
                >
                  <td className="py-2 pe-4">
                    {localizeOpsText(tText, g.label)}
                  </td>
                  <td className="py-2 pe-4 tabular-nums">
                    {codeLabel(t, "status", g.status)}
                  </td>
                  <td className="py-2 text-[var(--on-surface-variant)]">
                    <bdi>{localizeOpsText(tText, g.evidence)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("pilotCompletion")}
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            {t("pilotInstitutions", {
              count: data.pilot_completion?.institutions ?? 0,
            })}
          </li>
          <li>
            {t("objectivesMet", {
              answer: data.pilot_completion?.objectives_met ? t("yes") : t("no"),
            })}
          </li>
          <li>
            {t("simulationsCompleted", {
              count: data.pilot_completion?.simulations_completed ?? 0,
            })}
          </li>
          <li>
            {t("assessmentsCompleted", {
              count: data.pilot_completion?.assessments_completed ?? 0,
            })}
          </li>
          <li>
            {t("meanSatisfaction", {
              value: data.pilot_completion?.mean_user_satisfaction ?? 0,
            })}
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("workstreamCertifications")}
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          {certEntries.map(([key, value]) => (
            <li key={key}>
              {codeLabel(t, "workstream", value.workstream ?? key)}:{" "}
              <span className="tabular-nums">
                {value.overall
                  ? codeLabel(t, "status", value.overall)
                  : t("notAvailable")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.residual_risks?.length ? (
        <section>
          <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("residualRisks")}
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {data.residual_risks.slice(0, 10).map((r) => {
              const { id, description } = splitResidualRisk(r);
              return (
                <li key={r}>
                  {id ? (
                    <span className="tabular-nums text-[var(--on-surface-variant)]">
                      {id}:{" "}
                    </span>
                  ) : null}
                  {localizeOpsText(tText, description)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
