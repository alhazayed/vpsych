"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEGAL_PATHS } from "@/lib/compliance/constants";
import { createClient } from "@/lib/supabase/client";

type ConsentProfile = {
  display_name?: string;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  ai_processing_accepted_at?: string | null;
  marketing_opt_in?: boolean;
  data_retention_days?: number;
  organization?: string | null;
};

export default function AccountPrivacyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ConsentProfile | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/account/consent");
    if (res.status === 401) {
      router.push("/login?next=/account/privacy");
      return;
    }
    if (!res.ok) {
      setError("Failed to load privacy settings");
      return;
    }
    const data = (await res.json()) as {
      email: string | null;
      profile: ConsentProfile;
    };
    setEmail(data.email);
    setProfile(data.profile);
    setMarketing(Boolean(data.profile?.marketing_opt_in));
    setRetentionDays(Number(data.profile?.data_retention_days ?? 365));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrefs(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const res = await fetch("/api/account/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketingOptIn: marketing,
        dataRetentionDays: retentionDays,
        acceptAiProcessing: true,
        acceptTerms: true,
      }),
    });
    if (!res.ok) {
      setError("Could not save preferences");
      return;
    }
    setStatus("Preferences saved");
    await load();
  }

  async function exportData(mode: "full" | "research") {
    setError(null);
    const res = await fetch(`/api/account/export?mode=${mode}`);
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpsych-export-${mode}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${mode} export`);
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      setError('Type DELETE to confirm account erasure');
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    setDeleting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Deletion failed");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <Link href="/avatars" className="text-xs text-[var(--primary)] underline">
          ← Back
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-headline)] text-2xl font-bold">
          Privacy & data rights
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Export or erase your VPsych training data. Policies:{" "}
          <Link href={LEGAL_PATHS.privacy} className="underline">
            Privacy
          </Link>
          ,{" "}
          <Link href={LEGAL_PATHS.aiDisclosure} className="underline">
            AI Disclosure
          </Link>
          .
        </p>
      </div>

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

      <section className="space-y-2 rounded-xl border border-[var(--outline-variant)] p-4">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="text-sm">{email ?? "—"}</p>
        <p className="text-xs text-[var(--on-surface-variant)]">
          Terms accepted: {profile?.terms_accepted_at ?? "not recorded"} · AI
          processing: {profile?.ai_processing_accepted_at ?? "not recorded"}
        </p>
      </section>

      <form
        onSubmit={(e) => void savePrefs(e)}
        className="space-y-4 rounded-xl border border-[var(--outline-variant)] p-4"
      >
        <h2 className="text-sm font-semibold">Preferences</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1"
          />
          <span>Product / training newsletter (opt-in)</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-semibold">Preferred retention (days)</span>
          <input
            type="number"
            min={30}
            max={2555}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="field-input h-10 w-40"
          />
          <span className="block text-xs text-[var(--on-surface-variant)]">
            Institutions may enforce shorter institutional retention.
          </span>
        </label>
        <button type="submit" className="btn-primary">
          Save preferences
        </button>
      </form>

      <section className="space-y-3 rounded-xl border border-[var(--outline-variant)] p-4">
        <h2 className="text-sm font-semibold">Export your data</h2>
        <p className="text-xs text-[var(--on-surface-variant)]">
          Portable JSON for GDPR access / portability. Research mode removes
          names, emails, and transcripts.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void exportData("full")}
          >
            Download full export
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void exportData("research")}
          >
            Download anonymized research export
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--error)]/40 p-4">
        <h2 className="text-sm font-semibold text-[var(--error)]">
          Delete account
        </h2>
        <p className="text-xs text-[var(--on-surface-variant)]">
          Permanently deletes your auth user and cascaded training data
          (sessions, messages, learner profile). Type DELETE to confirm.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="field-input h-10 max-w-xs"
        />
        <button
          type="button"
          disabled={deleting}
          onClick={() => void deleteAccount()}
          className="rounded-lg bg-[var(--error)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Erase my account"}
        </button>
      </section>
    </div>
  );
}
