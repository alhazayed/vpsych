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
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f766e' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <p className="font-[family-name:var(--font-display)] text-xl tracking-tight">
          vpsych
        </p>
        <div className="flex gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[var(--ink)] hover:bg-[var(--wash)]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-24 pt-10">
        <p className="mb-4 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[var(--ink)] sm:text-7xl">
          vpsych
        </p>
        <h1 className="max-w-2xl text-2xl leading-snug text-[var(--ink)] sm:text-3xl">
          Train with patient avatars before seeing real people.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Conduct timed voice therapy sessions with disorder-specific avatars.
          Performance reports are generated after each session and kept
          admin-only.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Start training
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--line)] px-6 py-3 text-sm text-[var(--ink)] hover:bg-[var(--surface)]"
          >
            Therapist sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
