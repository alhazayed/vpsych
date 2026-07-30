"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/avatars";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image
          src="/vpsych-logo.png"
          alt="VPsych"
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg object-cover"
        />
        <span className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[var(--primary)]">
          VPsych
        </span>
      </Link>
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        Therapist and admin accounts use email and password.
      </p>
      <form onSubmit={onSubmit} className="clinical-card mt-8 space-y-4 p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </label>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--on-surface-variant)]">
        No account?{" "}
        <Link href="/signup" className="font-medium text-[var(--primary)] underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
