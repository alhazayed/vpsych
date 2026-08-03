"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Institution = {
  id: string;
  name: string;
  slug: string;
  country_code?: string;
  settings?: { archetype?: string };
};

type Dashboard = {
  summary: {
    membership_count: number;
    faculty_count: number;
    learner_count: number;
    assignment_count: number;
    published_assignments: number;
  };
  assignments: Array<{
    id: string;
    title: string;
    status: string;
    is_required: boolean;
    due_at?: string | null;
  }>;
  learners: Array<{
    id: string;
    user_id: string;
    profession?: string;
    certification_status?: string;
    completed_case_count?: number;
    confidence_score?: number;
  }>;
};

export default function FacultyDashboardPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState("");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadInstitutions = useCallback(async () => {
    const res = await fetch("/api/faculty/institutions");
    if (!res.ok) {
      setError(
        res.status === 403
          ? "Faculty membership required. Ask your institution admin for access."
          : "Failed to load institutions",
      );
      return;
    }
    const data = (await res.json()) as { institutions: Institution[] };
    setInstitutions(data.institutions ?? []);
    if (data.institutions?.[0] && !selected) {
      setSelected(data.institutions[0].id);
    }
  }, [selected]);

  const loadDashboard = useCallback(async (institutionId: string) => {
    if (!institutionId) return;
    setError(null);
    const res = await fetch("/api/faculty/institutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institution_id: institutionId }),
    });
    if (!res.ok) {
      setError("Failed to load faculty dashboard");
      return;
    }
    setDash((await res.json()) as Dashboard);
  }, []);

  useEffect(() => {
    void loadInstitutions();
  }, [loadInstitutions]);

  useEffect(() => {
    if (selected) void loadDashboard(selected);
  }, [selected, loadDashboard]);

  async function createAssignment(e: FormEvent) {
    e.preventDefault();
    if (!selected || !title.trim()) return;
    setStatus(null);
    const res = await fetch("/api/faculty/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_id: selected,
        title: title.trim(),
        status: "published",
        is_required: true,
      }),
    });
    if (!res.ok) {
      setError("Could not create assignment");
      return;
    }
    setTitle("");
    setStatus("Assignment published");
    await loadDashboard(selected);
  }

  async function exportResearch() {
    if (!selected) return;
    const res = await fetch("/api/faculty/research/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_id: selected,
        salt: `research-${selected.slice(0, 8)}-vpsych`,
        include_timestamps: false,
      }),
    });
    if (!res.ok) {
      setError("Research export failed or not permitted");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpsych-research-${selected.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Research export downloaded");
  }

  return (
    <main className="mx-auto max-w-[960px] space-y-8 px-4 py-8 md:px-8">
      <section>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          Faculty console
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Institution-scoped cohorts, assignments, learner outcomes, and
          anonymized research exports. Platform catalog tools remain under{" "}
          <Link href="/admin/curriculum" className="underline">
            Admin
          </Link>
          .
        </p>
      </section>

      {error && (
        <p className="rounded-lg bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-sm text-[var(--primary)]">
          {status}
        </p>
      )}

      <label className="block max-w-md space-y-1 text-sm">
        <span className="text-xs font-semibold">Institution</span>
        <select
          className="field-input h-11"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select…</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.settings?.archetype ? ` (${i.settings.archetype})` : ""}
            </option>
          ))}
        </select>
      </label>

      {dash && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Learners", dash.summary.learner_count],
                ["Faculty", dash.summary.faculty_count],
                ["Assignments", dash.summary.assignment_count],
                ["Published", dash.summary.published_assignments],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--outline-variant)] p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded-xl border border-[var(--outline-variant)] p-4">
            <h2 className="text-sm font-semibold">Assignments</h2>
            <ul className="space-y-2 text-sm">
              {dash.assignments.length === 0 && (
                <li className="text-[var(--on-surface-variant)]">
                  No assignments yet.
                </li>
              )}
              {dash.assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--outline-variant)]/60 py-2"
                >
                  <span>
                    {a.title}{" "}
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      ({a.status}
                      {a.is_required ? ", required" : ""})
                    </span>
                  </span>
                  {a.due_at && (
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      due {new Date(a.due_at).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => void createAssignment(e)}
              className="flex flex-wrap gap-2 pt-2"
            >
              <input
                className="field-input h-10 flex-1"
                placeholder="New required assignment title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Publish
              </button>
            </form>
          </section>

          <section className="space-y-3 rounded-xl border border-[var(--outline-variant)] p-4">
            <h2 className="text-sm font-semibold">Learners</h2>
            <ul className="max-h-64 space-y-2 overflow-auto text-sm">
              {dash.learners.length === 0 && (
                <li className="text-[var(--on-surface-variant)]">
                  No learner profiles bound to this institution yet.
                </li>
              )}
              {dash.learners.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="font-mono text-xs">
                    {l.user_id.slice(0, 8)}…
                  </span>
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    {l.profession ?? "—"} · {l.certification_status ?? "—"} ·
                    cases {l.completed_case_count ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--outline-variant)] p-4">
            <h2 className="text-sm font-semibold">Research export</h2>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Anonymized cohort export for IRB-approved secondary use
              (program directors / institution admins).
            </p>
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => void exportResearch()}
            >
              Download anonymized export
            </button>
          </section>
        </>
      )}
    </main>
  );
}
