"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_VQI_WEIGHT_ENTRIES,
  type VqiWeightEntry,
  type VqiWeightSet,
} from "@/lib/vqi/weights";

type Maturity =
  | "experimental"
  | "development"
  | "pilot_ready"
  | "production_ready"
  | "world_class";

function maturityLabel(level: Maturity): string {
  switch (level) {
    case "experimental":
      return "Experimental";
    case "development":
      return "Development";
    case "pilot_ready":
      return "Pilot Ready";
    case "production_ready":
      return "Production Ready";
    case "world_class":
      return "World-Class Educational Platform";
  }
}

type Confidence = {
  overall: number;
  scientific: number;
  clinical: number;
  educational: number;
  technical: number;
  institutional: number;
  research: number;
};

type PlatformVqi = {
  overall: number;
  maturity: Maturity;
  confidence: Confidence;
  confidence_interval: { lower: number; upper: number };
  scientific_interpretation: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  subscores: Array<{ metric_id: string; score: number | null; weight: number }>;
};

type Certificate = {
  certificate_id: string;
  overall_vqi: number;
  maturity: Maturity;
  confidence: Confidence;
  platform_readiness: string;
  institution_readiness: string;
  research_readiness: string;
  scientific_interpretation: string;
};

type Dashboard = {
  vqi_version: string;
  weight_set: VqiWeightSet;
  platform_vqi: PlatformVqi | null;
  certificate: Certificate | null;
  by_entity: Array<{
    entity_type: string;
    entity_id: string;
    overall: number;
    maturity: Maturity;
    n: number;
  }>;
  trends: Array<{ at: string; mean: number; n: number }>;
  benchmarks: Array<{
    label: string;
    delta: number;
    meaningful: boolean;
  }>;
  heat_map: Array<{ row: string; col: string; value: number }>;
  radar: Array<{ metric_id: string; score: number }>;
  distribution: Array<{ bucket: string; n: number }>;
  outliers: Array<{ entity_type: string; entity_id: string; overall: number }>;
  recommendations: string[];
};

type ScienceReport = {
  n: number;
  internal_consistency_alpha: number | null;
  repeatability_r: number | null;
  inter_language_abs_diff: number | null;
  inter_model_abs_diff: number | null;
  variance: number;
  explainability: string;
  notes: string[];
};

type ApiPayload = {
  dashboard?: Dashboard;
  science?: ScienceReport;
  certificate?: Certificate | null;
  weight_sets?: VqiWeightSet[];
  vqi_version?: string;
  source?: string;
  warning?: string;
  error?: string;
};

type TabId =
  | "executive"
  | "scientific"
  | "certificate"
  | "weights"
  | "entities"
  | "trends";

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MATURITY_CLASS: Record<string, string> = {
  experimental: "bg-red-100 text-red-800",
  development: "bg-amber-100 text-amber-900",
  pilot_ready: "bg-sky-100 text-sky-900",
  production_ready: "bg-emerald-100 text-emerald-900",
  world_class: "bg-indigo-100 text-indigo-900",
};

export function VqiDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [science, setScience] = useState<ScienceReport | null>(null);
  const [weightSets, setWeightSets] = useState<VqiWeightSet[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("executive");
  const [weightDraft, setWeightDraft] = useState<VqiWeightEntry[]>(
    DEFAULT_VQI_WEIGHT_ENTRIES.map((e) => ({ ...e })),
  );
  const [weightNotes, setWeightNotes] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vqi");
      const json = (await res.json()) as ApiPayload;
      if (!res.ok) throw new Error(json.error || "Failed to load VQI");
      setDashboard(json.dashboard ?? null);
      setScience(json.science ?? null);
      setWeightSets(json.weight_sets ?? []);
      setSource(json.source ?? "");
      if (json.dashboard?.weight_set?.entries?.length) {
        setWeightDraft(json.dashboard.weight_set.entries.map((e) => ({ ...e })));
      }
      if (json.warning) setActionMsg(json.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weightSum = useMemo(
    () => weightDraft.reduce((s, e) => s + e.weight, 0),
    [weightDraft],
  );

  const recompute = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vqi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persist: false }),
      });
      const json = (await res.json()) as ApiPayload & { ok?: boolean };
      if (!res.ok) throw new Error(json.error || "Compute failed");
      setDashboard(json.dashboard ?? null);
      setScience(json.science ?? null);
      setSource("offline_corpus");
      setActionMsg("VQI recomputed from offline corpus");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveWeights = async () => {
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/vqi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_weights",
          id: "admin-dashboard",
          name: "Admin Dashboard Weights",
          entries: weightDraft,
          notes: weightNotes || "Admin dashboard weight update",
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        weight_set?: VqiWeightSet;
      };
      if (!res.ok) throw new Error(json.error || "Save failed");
      setActionMsg(
        json.weight_set
          ? `Weight set saved as v${json.weight_set.version}`
          : "Weights saved",
      );
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const freezeWeights = async () => {
    if (!dashboard?.weight_set) return;
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/vqi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "freeze",
          id: dashboard.weight_set.id,
          version: dashboard.weight_set.version,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Freeze failed");
      setActionMsg("Active weight set frozen");
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Freeze failed");
    } finally {
      setBusy(false);
    }
  };

  const exportReport = async (format: "json" | "csv" | "research") => {
    const res = await fetch(`/api/admin/vqi?format=${format}`);
    if (format === "csv") {
      downloadBlob("vqi-export.csv", await res.text(), "text/csv");
      return;
    }
    downloadBlob(
      `vqi-export.${format}.json`,
      JSON.stringify(await res.json(), null, 2),
      "application/json",
    );
  };

  const platform = dashboard?.platform_vqi ?? null;
  const cert = dashboard?.certificate ?? null;
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "executive", label: "Executive" },
    { id: "scientific", label: "Scientific" },
    { id: "certificate", label: "Certificate" },
    { id: "weights", label: "Weights" },
    { id: "entities", label: "Entities" },
    { id: "trends", label: "Trends" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          Master quality metric
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          VPsych Quality Index
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          Hierarchical composite of CFI, ERI, AVI, ALE, and RRS — versioned
          weights, full provenance, confidence intervals, and quality
          certification. Not a simple average.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border px-2 py-1">
            VQI {dashboard?.vqi_version ?? "—"}
          </span>
          <span className="rounded-md border px-2 py-1">
            Weights {dashboard?.weight_set.id}@
            {dashboard?.weight_set.version}
            {dashboard?.weight_set.frozen ? " · frozen" : ""}
          </span>
          <span className="rounded-md border px-2 py-1">{source || "…"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void recompute()}
          disabled={busy}
          className="rounded-md border border-[var(--outline)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Recompute
        </button>
        <button
          type="button"
          onClick={() => void exportReport("json")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => void exportReport("csv")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => void exportReport("research")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Research dataset
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm">
          {actionMsg}
        </div>
      )}

      {!dashboard && busy && (
        <p className="text-sm text-[var(--on-surface-variant)]">Loading VQI…</p>
      )}

      {dashboard && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-[var(--outline-variant)] pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === t.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "executive" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6">
                  <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
                    Platform VQI
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums">
                    {platform?.overall.toFixed(1) ?? "—"}
                  </p>
                  {platform && (
                    <span
                      className={`mt-3 inline-block rounded-md px-2 py-1 text-xs font-semibold ${MATURITY_CLASS[platform.maturity] ?? ""}`}
                    >
                      {maturityLabel(platform.maturity)}
                    </span>
                  )}
                  <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                    Confidence{" "}
                    {platform?.confidence.overall.toFixed(1) ?? "—"} · CI [
                    {platform?.confidence_interval.lower.toFixed(1)},{" "}
                    {platform?.confidence_interval.upper.toFixed(1)}]
                  </p>
                </div>
                {dashboard.radar.map((r) => (
                  <div
                    key={r.metric_id}
                    className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5"
                  >
                    <p className="text-xs uppercase text-[var(--on-surface-variant)]">
                      {r.metric_id}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {r.score.toFixed(1)}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.min(100, r.score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--outline-variant)] p-5">
                <h2 className="font-semibold">Interpretation</h2>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  {platform?.scientific_interpretation ??
                    "No platform VQI available."}
                </p>
                {platform?.strengths.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Strengths</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-[var(--on-surface-variant)]">
                      {platform.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {platform?.weaknesses.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-medium">Weaknesses</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-[var(--on-surface-variant)]">
                      {platform.weaknesses.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === "scientific" && science && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["α (internal)", science.internal_consistency_alpha],
                  ["Repeatability r", science.repeatability_r],
                  ["Variance", science.variance],
                  ["Explainability", science.explainability],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--outline-variant)] p-4"
                  >
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {val == null
                        ? "—"
                        : typeof val === "number"
                          ? val.toFixed(3)
                          : String(val)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  Inter-language |Δ|:{" "}
                  <strong>
                    {science.inter_language_abs_diff?.toFixed(1) ?? "—"}
                  </strong>
                </p>
                <p>
                  Inter-model |Δ|:{" "}
                  <strong>
                    {science.inter_model_abs_diff?.toFixed(1) ?? "—"}
                  </strong>
                </p>
                <p>
                  N observations: <strong>{science.n}</strong>
                </p>
              </div>
              {science.notes.length > 0 && (
                <ul className="list-inside list-disc text-sm text-[var(--on-surface-variant)]">
                  {science.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <div>
                <h2 className="font-semibold">Score distribution</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dashboard.distribution.map((b) => (
                    <div
                      key={b.bucket}
                      className="min-w-[4.5rem] rounded-md border border-[var(--outline-variant)] px-3 py-2 text-center text-xs"
                    >
                      <div className="text-[var(--on-surface-variant)]">
                        {b.bucket}
                      </div>
                      <div className="text-lg font-bold tabular-nums">{b.n}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "certificate" && cert && (
            <div className="rounded-xl border border-[var(--outline-variant)] p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs uppercase text-[var(--on-surface-variant)]">
                    Quality Certificate
                  </p>
                  <p className="text-4xl font-bold tabular-nums">
                    {cert.overall_vqi.toFixed(1)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-3 py-1 text-sm font-semibold ${MATURITY_CLASS[cert.maturity] ?? ""}`}
                >
                  {maturityLabel(cert.maturity)}
                </span>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {cert.certificate_id}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["Scientific", cert.confidence.scientific],
                    ["Clinical", cert.confidence.clinical],
                    ["Educational", cert.confidence.educational],
                    ["Technical", cert.confidence.technical],
                    ["Institutional", cert.confidence.institutional],
                    ["Research", cert.confidence.research],
                  ] as const
                ).map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-md border border-[var(--outline-variant)] p-3"
                  >
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {label} confidence
                    </p>
                    <p className="text-xl font-bold tabular-nums">
                      {val.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {cert.scientific_interpretation}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  <span className="font-medium">Platform:</span>{" "}
                  {cert.platform_readiness}
                </p>
                <p>
                  <span className="font-medium">Institution:</span>{" "}
                  {cert.institution_readiness}
                </p>
                <p>
                  <span className="font-medium">Research:</span>{" "}
                  {cert.research_readiness}
                </p>
              </div>
              {platform?.recommendations.length ? (
                <div>
                  <p className="font-medium text-sm">Recommended improvements</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-[var(--on-surface-variant)]">
                    {platform.recommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {tab === "certificate" && !cert && (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No certificate — platform VQI required.
            </p>
          )}

          {tab === "weights" && (
            <div className="space-y-4 rounded-xl border border-[var(--outline-variant)] p-5">
              <p className="text-sm text-[var(--on-surface-variant)]">
                Editable weight set (must sum to 100%). Every save creates a new
                version. Frozen sets cannot be mutated — create a new version
                instead.
              </p>
              <p className="text-sm">
                Sum:{" "}
                <strong
                  className={
                    Math.abs(weightSum - 1) < 1e-6
                      ? "text-emerald-700"
                      : "text-red-700"
                  }
                >
                  {(weightSum * 100).toFixed(1)}%
                </strong>
              </p>
              <div className="space-y-3">
                {weightDraft.map((e) => (
                  <div
                    key={e.metric_id}
                    className="grid gap-2 sm:grid-cols-[100px_120px_1fr] sm:items-center"
                  >
                    <label className="text-sm font-semibold uppercase">
                      {e.metric_id}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={e.weight}
                      onChange={(ev) => {
                        const w = Number(ev.target.value);
                        setWeightDraft((prev) =>
                          prev.map((row) =>
                            row.metric_id === e.metric_id
                              ? { ...row, weight: w }
                              : row,
                          ),
                        );
                      }}
                      className="rounded-md border border-[var(--outline)] bg-transparent px-3 py-1.5 text-sm"
                    />
                    <p className="truncate text-xs text-[var(--on-surface-variant)]">
                      {e.rationale}
                    </p>
                  </div>
                ))}
              </div>
              <textarea
                value={weightNotes}
                onChange={(ev) => setWeightNotes(ev.target.value)}
                rows={2}
                placeholder="Change notes (versioned with weight set)"
                className="w-full rounded-md border border-[var(--outline)] bg-transparent px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || Math.abs(weightSum - 1) >= 1e-6}
                  onClick={() => void saveWeights()}
                  className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                >
                  Save new weight version
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void freezeWeights()}
                  className="rounded-md border border-[var(--outline)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Freeze active set
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWeightDraft(
                      DEFAULT_VQI_WEIGHT_ENTRIES.map((x) => ({ ...x })),
                    )
                  }
                  className="rounded-md px-3 py-2 text-sm text-[var(--on-surface-variant)]"
                >
                  Reset defaults
                </button>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                History:{" "}
                {weightSets
                  .map((w) => `${w.id}@${w.version}${w.frozen ? "*" : ""}`)
                  .join(" → ") || "default only"}
              </p>
            </div>
          )}

          {tab === "entities" && (
            <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">VQI</th>
                    <th className="px-4 py-3 font-medium">Maturity</th>
                    <th className="px-4 py-3 font-medium">n</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.by_entity.map((row) => (
                    <tr
                      key={`${row.entity_type}:${row.entity_id}`}
                      className="border-b border-[var(--outline-variant)]/60"
                    >
                      <td className="px-4 py-2">
                        <span className="text-xs uppercase text-[var(--on-surface-variant)]">
                          {row.entity_type}
                        </span>{" "}
                        {row.entity_id}
                      </td>
                      <td className="px-4 py-2 font-semibold tabular-nums">
                        {row.overall.toFixed(1)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${MATURITY_CLASS[row.maturity] ?? ""}`}
                        >
                          {maturityLabel(row.maturity)}
                        </span>
                      </td>
                      <td className="px-4 py-2 tabular-nums">{row.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboard.heat_map.length > 0 && (
                <div className="border-t border-[var(--outline-variant)] p-4">
                  <h3 className="text-sm font-semibold">Sub-index heat map</h3>
                  <div className="mt-2 max-h-64 overflow-auto text-xs">
                    {dashboard.heat_map.slice(0, 40).map((cell, i) => (
                      <div
                        key={`${cell.row}-${cell.col}-${i}`}
                        className="flex justify-between gap-4 border-b border-[var(--outline-variant)]/40 py-1"
                      >
                        <span>
                          {cell.row} · {cell.col}
                        </span>
                        <span className="tabular-nums font-medium">
                          {cell.value.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "trends" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--outline-variant)] p-5">
                <h2 className="font-semibold">Longitudinal VQI</h2>
                {dashboard.trends.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                    Insufficient history for trend series.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {dashboard.trends.map((p) => (
                      <div key={p.at} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-[var(--on-surface-variant)]">
                          {p.at}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${Math.min(100, p.mean)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm tabular-nums">
                          {p.mean.toFixed(1)}
                        </span>
                        <span className="w-10 text-right text-xs text-[var(--on-surface-variant)]">
                          n={p.n}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[var(--outline-variant)] p-5">
                <h2 className="font-semibold">Benchmarks</h2>
                <div className="mt-3 space-y-2">
                  {dashboard.benchmarks.map((b) => (
                    <div
                      key={b.label}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm"
                    >
                      <span>{b.label}</span>
                      <span className="tabular-nums">
                        Δ {b.delta >= 0 ? "+" : ""}
                        {b.delta.toFixed(1)}
                        {b.meaningful ? (
                          <span className="ml-2 rounded bg-[var(--surface-container)] px-1.5 py-0.5 text-xs">
                            meaningful
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {dashboard.outliers.length > 0 && (
                <div className="rounded-xl border border-[var(--outline-variant)] p-5">
                  <h2 className="font-semibold">Outliers (|z| &gt; 2)</h2>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {dashboard.outliers.map((o) => (
                      <li key={`${o.entity_type}:${o.entity_id}`}>
                        {o.entity_type}:{o.entity_id} = {o.overall.toFixed(1)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
