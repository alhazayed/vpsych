"use client";

import Image from "next/image";
import Link from "next/link";
import type { VirtualPatientListItem } from "@/lib/admin/virtual-patients";
import { StatusBadge } from "./StatusBadge";
import { DIFFICULTY_LABELS, titleCaseToken } from "./labels";

export function VirtualPatientCard({
  item,
  onDuplicate,
  onTest,
  onArchive,
  onOpen,
}: {
  item: VirtualPatientListItem;
  onDuplicate: (item: VirtualPatientListItem) => void;
  onTest: (item: VirtualPatientListItem) => void;
  onArchive: (item: VirtualPatientListItem) => void;
  onOpen: (item: VirtualPatientListItem) => void;
}) {
  const published = item.status === "published";
  const archived = item.status === "archived";
  const difficultyLabel =
    item.difficulty && item.difficulty in DIFFICULTY_LABELS
      ? DIFFICULTY_LABELS[
          item.difficulty as keyof typeof DIFFICULTY_LABELS
        ]
      : titleCaseToken(item.difficulty);

  const competencies = item.targetCompetencies.slice(0, 3);

  return (
    <article className="clinical-card clinical-card-interactive flex flex-col overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-container)]">
          {item.portraitUrl ? (
            <Image
              src={item.portraitUrl}
              alt={item.displayName}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--primary)]">
              {item.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--on-surface)]">
              {item.displayName}
            </h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {[
              item.age != null ? `${item.age} yrs` : null,
              item.gender ? titleCaseToken(item.gender) : null,
              item.diagnosis || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-[var(--outline)]">
            {[
              difficultyLabel !== "—" ? difficultyLabel : null,
              item.language
                ? item.language.startsWith("ar")
                  ? "Arabic"
                  : "English"
                : null,
              item.dialect,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {competencies.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {competencies.map((c) => (
                <li
                  key={c}
                  className="rounded bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]"
                >
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--outline-variant)] px-4 py-3">
        <Link
          href={`/admin/virtual-patients/${item.id}`}
          onClick={() => onOpen(item)}
          className="btn-secondary h-8 px-2.5 text-xs"
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          Open
        </Link>
        {published ? (
          <button
            type="button"
            className="btn-secondary h-8 px-2.5 text-xs"
            onClick={() => onDuplicate(item)}
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            Duplicate
          </button>
        ) : (
          <Link
            href={`/admin/virtual-patients/${item.id}`}
            className="btn-secondary h-8 px-2.5 text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit
          </Link>
        )}
        <button
          type="button"
          className="btn-secondary h-8 px-2.5 text-xs"
          disabled={archived}
          onClick={() => onTest(item)}
        >
          <span className="material-symbols-outlined text-[16px]">science</span>
          Test
        </button>
        {!archived && !published ? (
          <button
            type="button"
            className="btn-secondary h-8 px-2.5 text-xs"
            onClick={() => onDuplicate(item)}
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            Duplicate
          </button>
        ) : null}
        {!archived ? (
          <button
            type="button"
            className="btn-secondary h-8 px-2.5 text-xs text-[var(--secondary)]"
            onClick={() => onArchive(item)}
          >
            <span className="material-symbols-outlined text-[16px]">archive</span>
            Archive
          </button>
        ) : null}
      </div>
    </article>
  );
}
