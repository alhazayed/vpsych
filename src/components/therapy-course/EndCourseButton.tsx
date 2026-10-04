"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EndCourseButton({
  courseId,
  patientName,
}: {
  courseId: string;
  patientName: string;
}) {
  const t = useTranslations("course");
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function end() {
    if (!window.confirm(t("endCourseConfirm", { name: patientName }))) return;
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/end`, { method: "POST" });
      if (!res.ok) {
        setError(t("endCourseError"));
        setEnding(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("errors.network"));
      setEnding(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn-secondary h-11 w-full"
        onClick={() => void end()}
        disabled={ending}
      >
        <span className="material-symbols-outlined text-[20px]">flag</span>
        {ending ? t("endingCourse") : t("endCourse")}
      </button>
      {error && (
        <p className="mt-2 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
