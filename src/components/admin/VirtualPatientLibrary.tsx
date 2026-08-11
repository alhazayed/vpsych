"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  assessVirtualPatientCompleteness,
  listAvailableLocales,
} from "@/lib/admin/virtual-patient-completeness";
import {
  lifecycleBadgeTone,
  readLifecycleFromRow,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";
import type { Avatar } from "@/lib/types";

export type VirtualPatientListItem = Pick<
  Avatar,
  | "id"
  | "name"
  | "disorder"
  | "age"
  | "gender"
  | "is_active"
  | "lifecycle_status"
  | "language"
  | "dialect"
  | "voice_id"
  | "voice_id_ar"
  | "voice_profile_id"
  | "human_personality"
  | "personalities"
  | "clinical_core"
  | "persona_prompt"
  | "available_locales"
  | "portrait_url"
  | "slug"
> & {
  voice_profile_name?: string | null;
};

type SortKey = "name" | "disorder" | "status" | "completeness";
type StatusFilter =
  | "all"
  | "draft"
  | "testing"
  | "published"
  | "archived"
  | "incomplete";

/** Higher rank sorts first when sorting by lifecycle status. */
const LIFECYCLE_SORT_RANK: Record<VirtualPatientLifecycleStatus, number> = {
  published: 4,
  testing: 3,
  draft: 2,
  archived: 1,
};

export function VirtualPatientLibrary({
  patients,
  labels,
}: {
  patients: VirtualPatientListItem[];
  labels: {
    search: string;
    filterAll: string;
    filterDraft: string;
    filterTesting: string;
    filterPublished: string;
    filterArchived: string;
    filterIncomplete: string;
    sortName: string;
    sortDiagnosis: string;
    sortStatus: string;
    sortCompleteness: string;
    empty: string;
    view: string;
    create: string;
    createHint: string;
    statusDraft: string;
    statusTesting: string;
    statusPublished: string;
    statusArchived: string;
    complete: string;
    incomplete: string;
    voiceOk: string;
    voiceMissing: string;
    personalityOk: string;
    personalityPartial: string;
    personalityMissing: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [showCreateHint, setShowCreateHint] = useState(false);

  const statusLabel = (
    lifecycle: VirtualPatientLifecycleStatus,
  ): string => {
    switch (lifecycle) {
      case "draft":
        return labels.statusDraft;
      case "testing":
        return labels.statusTesting;
      case "published":
        return labels.statusPublished;
      case "archived":
        return labels.statusArchived;
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = patients.map((p) => {
      const completeness = assessVirtualPatientCompleteness(p);
      const locales = listAvailableLocales(p);
      const lifecycle = readLifecycleFromRow(p);
      return { patient: p, completeness, locales, lifecycle };
    });

    if (q) {
      list = list.filter(({ patient, locales }) => {
        const hay = [
          patient.name,
          patient.disorder,
          patient.gender,
          patient.slug,
          ...locales,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (
      status === "draft" ||
      status === "testing" ||
      status === "published" ||
      status === "archived"
    ) {
      list = list.filter((r) => r.lifecycle === status);
    }
    if (status === "incomplete")
      list = list.filter((r) => !r.completeness.isComplete);

    list.sort((a, b) => {
      if (sort === "disorder") {
        return (a.patient.disorder ?? "").localeCompare(
          b.patient.disorder ?? "",
        );
      }
      if (sort === "status") {
        return (
          LIFECYCLE_SORT_RANK[b.lifecycle] - LIFECYCLE_SORT_RANK[a.lifecycle]
        );
      }
      if (sort === "completeness") {
        return (
          Number(b.completeness.isComplete) - Number(a.completeness.isComplete)
        );
      }
      return a.patient.name.localeCompare(b.patient.name);
    });

    return list;
  }, [patients, query, status, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[240px] flex-1 flex-wrap gap-3">
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
              {labels.search}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
              Filter
            </span>
            <select
              className="mt-1 block rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">{labels.filterAll}</option>
              <option value="draft">{labels.filterDraft}</option>
              <option value="testing">{labels.filterTesting}</option>
              <option value="published">{labels.filterPublished}</option>
              <option value="archived">{labels.filterArchived}</option>
              <option value="incomplete">{labels.filterIncomplete}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
              Sort
            </span>
            <select
              className="mt-1 block rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="name">{labels.sortName}</option>
              <option value="disorder">{labels.sortDiagnosis}</option>
              <option value="status">{labels.sortStatus}</option>
              <option value="completeness">{labels.sortCompleteness}</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateHint(true)}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          {labels.create}
        </button>
      </div>

      {showCreateHint ? (
        <div
          className="clinical-card border border-[color-mix(in_srgb,var(--secondary)_35%,var(--outline-variant))] p-5"
          role="status"
        >
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--on-surface)]">
            {labels.create}
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {labels.createHint}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/avatars/new" className="btn-secondary">
              Open workflow shell
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreateHint(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{labels.empty}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ patient, completeness, locales, lifecycle }) => {
            const personalityTone =
              completeness.hasEnPersonality && completeness.hasArPersonality
                ? "active"
                : completeness.hasEnPersonality || completeness.hasArPersonality
                  ? "warning"
                  : "inactive";
            const personalityLabel =
              completeness.hasEnPersonality && completeness.hasArPersonality
                ? labels.personalityOk
                : completeness.hasEnPersonality || completeness.hasArPersonality
                  ? labels.personalityPartial
                  : labels.personalityMissing;

            return (
              <li key={patient.id} className="clinical-card flex flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                      {patient.name}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                      {patient.disorder}
                      {patient.age != null ? ` · ${patient.age}` : ""}
                      {patient.gender ? ` · ${patient.gender}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    label={statusLabel(lifecycle)}
                    tone={lifecycleBadgeTone(lifecycle)}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge
                    label={
                      completeness.isComplete
                        ? labels.complete
                        : labels.incomplete
                    }
                    tone={completeness.isComplete ? "info" : "warning"}
                  />
                  <StatusBadge
                    label={
                      completeness.hasVoice
                        ? labels.voiceOk
                        : labels.voiceMissing
                    }
                    tone={completeness.hasVoice ? "active" : "warning"}
                  />
                  <StatusBadge
                    label={personalityLabel}
                    tone={personalityTone}
                  />
                </div>

                <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
                  Languages:{" "}
                  {locales.length
                    ? locales.join(", ")
                    : patient.language || "—"}
                  {patient.voice_profile_name
                    ? ` · Voice: ${patient.voice_profile_name}`
                    : ""}
                </p>

                {!completeness.isComplete ? (
                  <ul className="mt-2 list-disc space-y-0.5 ps-5 text-xs text-[var(--secondary)]">
                    {completeness.incompleteReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-auto pt-4">
                  <Link
                    href={`/admin/avatars/${patient.id}`}
                    className="btn-secondary"
                  >
                    {labels.view}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
