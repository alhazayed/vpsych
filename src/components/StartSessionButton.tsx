"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartSessionButton({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start session");
        setLoading(false);
        return;
      }
      router.push(`/sessions/${data.sessionId}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={loading}
        className="btn-primary w-full"
      >
        <span className="material-symbols-outlined text-[20px]">mic</span>
        {loading ? "Starting…" : "Start 40-min voice session"}
      </button>
      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
