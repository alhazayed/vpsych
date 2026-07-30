import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/avatars");

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 12% -8%, rgba(29,98,150,0.12) 0%, transparent 55%), radial-gradient(700px 420px at 100% 0%, rgba(253,108,21,0.08) 0%, transparent 50%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/vpsych-logo.png"
            alt="VPsych"
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-cover"
            priority
          />
          <div>
            <p className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[var(--primary)]">
              VPsych
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
              Healthcare
            </p>
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-24 pt-10">
        <p className="mb-4 font-[family-name:var(--font-headline)] text-5xl font-bold leading-none tracking-tight text-[var(--primary)] sm:text-7xl">
          VPsych
        </p>
        <h1 className="max-w-2xl font-[family-name:var(--font-headline)] text-2xl font-semibold leading-snug text-[var(--on-surface)] sm:text-3xl">
          Clinical assessment training with AI patient simulations.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--on-surface-variant)] sm:text-lg">
          Conduct timed voice therapy sessions with disorder-specific avatars.
          Performance reports are generated after each session and kept
          admin-only.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3">
            Start training
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3">
            Therapist sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
