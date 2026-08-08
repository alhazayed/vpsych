"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  DuplicateVirtualPatientInput,
  VirtualPatientLifecycle,
  VirtualPatientListItem,
} from "@/lib/admin/virtual-patients";
import { VirtualPatientCard } from "./VirtualPatientCard";
import { DIFFICULTY_LABELS } from "./labels";

const STATUS_FILTERS: Array<VirtualPatientLifecycle | "all"> = [
  "all",
  "draft",
  "testing",
  "published",
  "archived",
];

const STATUS_FILTER_LABELS: Record<VirtualPatientLifecycle | "all", string> = {
  all: "All statuses",
  draft: "Draft",
  testing: "Testing",
  published: "Published",
  archived: "Archived",
};

type DupForm = {
  newName: string;
  newDiagnosis: string;
  newDifficulty: DuplicateVirtualPatientInput["newDifficulty"] | "";
  language: "en" | "ar" | "";
  dialect: string;
};

const EMPTY_DUP: DupForm = {
  newName: "",
  newDiagnosis: "",
  newDifficulty: "",
  language: "",
  dialect: "",
};

export function VirtualPatientLibrary({
  initialItems = [],
}: {
  initialItems?: VirtualPatientListItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<VirtualPatientListItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    VirtualPatientLifecycle | "all"
  >("all");
  const [dupTarget, setDupTarget] = useState<VirtualPatientListItem | null>(
    null,
  );
  const [dupForm, setDupForm] = useState<DupForm>(EMPTY_DUP);
  const [dupError, setDupError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/virtual-patients");
      const data = (await res.json()) as {
        items?: VirtualPatientListItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load virtual patients.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Could not load virtual patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        item.displayName,
        item.diagnosis,
        item.dialect ?? "",
        item.language ?? "",
        item.difficulty ?? "",
        ...item.targetCompetencies,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter]);

  function openDuplicate(item: VirtualPatientListItem) {
    setDupTarget(item);
    setDupError(null);
    setDupForm({
      newName: `${item.displayName} (copy)`,
      newDiagnosis: "",
      newDifficulty: "",
      language: "",
      dialect: item.dialect ?? "",
    });
  }

  function submitDuplicate() {
    if (!dupTarget) return;
    const name = dupForm.newName.trim();
    if (!name) {
      setDupError("New name is required.");
      return;
    }
    startTransition(async () => {
      setDupError(null);
      const body: DuplicateVirtualPatientInput = { newName: name };
      if (dupForm.newDiagnosis.trim()) {
        body.newDiagnosis = dupForm.newDiagnosis.trim();
      }
      if (dupForm.newDifficulty) body.newDifficulty = dupForm.newDifficulty;
      if (dupForm.language) body.language = dupForm.language;
      if (dupForm.dialect.trim()) body.dialect = dupForm.dialect.trim();

      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${dupTarget.id}/duplicate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const data = (await res.json()) as {
          item?: VirtualPatientListItem;
          error?: string;
        };
        if (!res.ok || !data.item) {
          setDupError(data.error ?? "Duplicate failed.");
          return;
        }
        setDupTarget(null);
        router.push(`/admin/virtual-patients/${data.item.id}`);
      } catch {
        setDupError("Duplicate failed.");
      }
    });
  }

  function onTest(item: VirtualPatientListItem) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${item.id}/test-session`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const data = (await res.json()) as {
          path?: string;
          error?: string;
        };
        if (!res.ok || !data.path) {
          setError(data.error ?? "Could not start test session.");
          return;
        }
        router.push(data.path);
      } catch {
        setError("Could not start test session.");
      }
    });
  }

  function onArchive(item: VirtualPatientListItem) {
    if (!window.confirm(`Archive “${item.displayName}”?`)) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${item.id}/lifecycle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "archived" }),
          },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not archive.");
          return;
        }
        await load();
      } catch {
        setError("Could not archive.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
            Virtual Patients
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
            Create, test, and publish standardized patients for training
            sessions.
          </p>
        </div>
        <Link href="/admin/virtual-patients/new" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Virtual Patient
        </Link>
      </div>

      <div className="clinical-card flex flex-wrap gap-3 p-4">
        <label className="min-w-[12rem] flex-1 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, diagnosis, competency…"
            className="field-input mt-1.5 normal-case tracking-normal"
          />
        </label>
        <label className="w-full text-xs font-semibold uppercase tracking-wider text-[var(--outline)] sm:w-48">
          Status
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as VirtualPatientLifecycle | "all")
            }
            className="field-input mt-1.5 normal-case tracking-normal"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_FILTER_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_8%,transparent)] px-4 py-3 text-sm text-[var(--secondary)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Loading virtual patients…
        </p>
      ) : filtered.length === 0 ? (
        <div className="clinical-card p-8 text-center">
          <p className="text-sm text-[var(--on-surface-variant)]">
            No virtual patients match your filters.
          </p>
          <Link
            href="/admin/virtual-patients/new"
            className="btn-primary mt-4 inline-flex"
          >
            Create Virtual Patient
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <VirtualPatientCard
              key={item.id}
              item={item}
              onDuplicate={openDuplicate}
              onTest={onTest}
              onArchive={onArchive}
              onOpen={() => undefined}
            />
          ))}
        </div>
      )}

      {dupTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--on-surface)_40%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-title"
        >
          <div className="clinical-card w-full max-w-md space-y-4 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="dup-title"
                  className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]"
                >
                  Duplicate virtual patient
                </h2>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  Creates a new draft from {dupTarget.displayName}.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary h-8 w-8 p-0"
                onClick={() => setDupTarget(null)}
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
              New name
              <input
                className="field-input mt-1.5 normal-case tracking-normal"
                value={dupForm.newName}
                onChange={(e) =>
                  setDupForm((f) => ({ ...f, newName: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
              New diagnosis (optional)
              <input
                className="field-input mt-1.5 normal-case tracking-normal"
                value={dupForm.newDiagnosis}
                onChange={(e) =>
                  setDupForm((f) => ({ ...f, newDiagnosis: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
              Difficulty (optional)
              <select
                className="field-input mt-1.5 normal-case tracking-normal"
                value={dupForm.newDifficulty}
                onChange={(e) =>
                  setDupForm((f) => ({
                    ...f,
                    newDifficulty: e.target
                      .value as DupForm["newDifficulty"],
                  }))
                }
              >
                <option value="">Keep current</option>
                {(
                  Object.keys(DIFFICULTY_LABELS) as Array<
                    keyof typeof DIFFICULTY_LABELS
                  >
                ).map((k) => (
                  <option key={k} value={k}>
                    {DIFFICULTY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Language
                <select
                  className="field-input mt-1.5 normal-case tracking-normal"
                  value={dupForm.language}
                  onChange={(e) =>
                    setDupForm((f) => ({
                      ...f,
                      language: e.target.value as DupForm["language"],
                    }))
                  }
                >
                  <option value="">Keep current</option>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Dialect
                <input
                  className="field-input mt-1.5 normal-case tracking-normal"
                  value={dupForm.dialect}
                  onChange={(e) =>
                    setDupForm((f) => ({ ...f, dialect: e.target.value }))
                  }
                />
              </label>
            </div>

            {dupError ? (
              <p className="text-sm text-[var(--secondary)]">{dupError}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setDupTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={submitDuplicate}
              >
                {pending ? "Duplicating…" : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
