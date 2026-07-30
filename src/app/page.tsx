import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const FEATURES = [
  {
    icon: "psychology",
    title: "Clinical Simulations",
    body: "Immersive scenarios covering anxiety, depression, PTSD, and complex personality disorders.",
  },
  {
    icon: "face_6",
    title: "AI Patient Avatars",
    body: "Responsive avatars with dynamic facial expressions and realistic emotional vocal modulation.",
  },
  {
    icon: "assignment_turned_in",
    title: "Competency-Based Feedback",
    body: "Instant scoring on empathy, verbal reflections, and adherence to therapeutic modalities.",
  },
  {
    icon: "analytics",
    title: "Performance Analytics",
    body: "Visualize your growth over time with detailed charts mapping your diagnostic accuracy.",
  },
  {
    icon: "monitoring",
    title: "Progress Tracking",
    body: "Curated learning paths that adapt based on your strengths and identified areas for improvement.",
  },
  {
    icon: "translate",
    title: "Arabic & English Support",
    body: "Full bilingual capability to support diverse practitioners across global medical contexts.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Create Session",
    body: "Select a clinical persona and start a timed voice assessment session.",
  },
  {
    n: "2",
    title: "Conduct Therapy",
    body: "Engage in natural conversation with the AI patient via voice or text input.",
  },
  {
    n: "3",
    title: "Receive AI Report",
    body: "Get a comprehensive clinical analysis with specific feedback on your techniques.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The diagnostic reasoning feedback is revolutionary. It catches nuances in interviewing technique that are often missed in traditional residency training.",
    name: "Dr. Sarah Khalil",
    role: "Senior Psychiatrist",
    initials: "SK",
  },
  {
    quote:
      "As a clinical psychologist, I find the AI's emotional responses incredibly authentic. It's an invaluable tool for mastering therapeutic alliance building.",
    name: "Dr. James Wilson",
    role: "Clinical Psychologist",
    initials: "JW",
  },
  {
    quote:
      "VPsych helped me build confidence before my first real-world clinical rotation. The progress tracking keeps me motivated to keep refining my skills.",
    name: "Layla Ahmed",
    role: "Medical Resident",
    initials: "LA",
  },
];

const FAQS = [
  {
    q: "How realistic are AI patients?",
    a: "Our models are tuned for clinical training scenarios so behavior patterns, vocabulary, and symptom presentation feel authentic for practice.",
  },
  {
    q: "Can supervisors review sessions?",
    a: "Yes. Admin accounts can review performance reports generated after each session while therapist access remains appropriately scoped.",
  },
  {
    q: "Is patient data recorded?",
    a: "We do not store real patient information. Simulations use fictional personas. Training session data is handled with security-first defaults.",
  },
  {
    q: "Does the platform support Arabic?",
    a: "VPsych is designed for bilingual clinical training contexts, with Arabic and English support on the product roadmap and UI.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/avatars");

  return (
    <div className="overflow-x-hidden bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="sticky top-0 z-50 border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[var(--primary)]"
            >
              VPsych
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#features"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                Pricing
              </a>
              <a
                href="#about"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                About
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                Resources
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-container)_10%,transparent)] sm:inline"
            >
              Login
            </Link>
            <Link href="/signup" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-[1280px] overflow-hidden px-6 pb-20 pt-12 md:px-8 md:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="z-10 fade-in-up">
              <span className="mb-4 inline-block rounded-full bg-[var(--secondary-fixed)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-secondary-fixed-variant)]">
                Next-Gen Clinical Training
              </span>
              <h1 className="font-[family-name:var(--font-headline)] text-4xl font-bold leading-tight tracking-tight text-[var(--primary)] md:text-5xl md:leading-[1.15]">
                Practice Psychotherapy with AI Patients
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-7 text-[var(--on-surface-variant)]">
                Train your interviewing, diagnostic reasoning, psychotherapy
                techniques, and therapeutic communication using highly realistic
                AI patient simulations.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/signup" className="btn-primary px-8 py-3 shadow-lg">
                  Start Free
                </Link>
                <a
                  href="#features"
                  className="btn-secondary px-8 py-3"
                >
                  <span className="material-symbols-outlined">play_circle</span>
                  Watch Demo
                </a>
              </div>
            </div>
            <div className="relative mt-4 lg:mt-0 fade-in-up">
              <div className="absolute -right-12 -top-12 -z-10 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--secondary-container)_10%,transparent)] blur-3xl" />
              <div className="overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)] shadow-2xl">
                <Image
                  src="/stitch/landing-hero.png"
                  alt="Therapist conducting a session with an AI patient avatar"
                  width={1376}
                  height={768}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto my-16 max-w-[1280px] rounded-[32px] border border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-lowest)] px-6 py-16 shadow-sm md:px-8"
        >
          <div className="mb-10 text-center">
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              Advanced Clinical Training Tools
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--on-surface-variant)]">
              Master complex therapeutic skills through our specialized
              simulation suite.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary-container)_20%,transparent)] text-[var(--primary)]">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {f.icon}
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-base text-[var(--on-surface-variant)]">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16 text-center md:px-8">
          <h2 className="mb-10 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)] md:text-2xl md:font-semibold">
            How VPsych Works
          </h2>
          <div className="relative">
            <div className="absolute left-0 top-1/2 -z-10 hidden h-0.5 w-full bg-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] md:block" />
            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8 shadow-sm"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white shadow-md">
                    {s.n}
                  </div>
                  <h4 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]">
                    {s.title}
                  </h4>
                  <p className="text-[var(--on-surface-variant)]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] shadow-lg">
            <Image
              src="/stitch/workflow.png"
              alt="VPsych workflow from session creation to analysis"
              width={1376}
              height={768}
              className="h-auto w-full object-cover"
            />
          </div>
        </section>

        <section className="bg-[var(--primary)] py-16 text-white" id="about">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-6 text-center lg:grid-cols-4 md:px-8">
            {[
              ["10,000+", "Practice Sessions"],
              ["500+", "AI Patient Cases"],
              ["25+", "Clinical Competencies"],
              ["95%", "User Satisfaction"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="font-[family-name:var(--font-headline)] text-4xl font-bold tracking-tight md:text-5xl">
                  {value}
                </div>
                <div className="mt-2 text-sm font-medium uppercase tracking-widest opacity-80">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16 md:px-8">
          <h2 className="mb-10 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
            Trusted by Professionals
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface-container-low)] p-6"
              >
                <p className="mb-6 italic text-[var(--on-surface-variant)]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-fixed)] font-bold text-[var(--primary)]">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--primary)]">
                      {t.name}
                    </div>
                    <div className="text-xs text-[var(--on-surface-variant)]">
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className="mx-auto max-w-[1280px] px-6 py-16 md:px-8"
        >
          <div className="mb-10 text-center">
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
              Scale Your Expertise
            </h2>
            <p className="mt-2 text-[var(--on-surface-variant)]">
              Plans designed for individual learners and major medical
              institutions.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8">
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                Free
              </div>
              <div className="mb-6 font-[family-name:var(--font-headline)] text-5xl font-bold text-[var(--primary)]">
                $0
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Practice sessions with preset avatars
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Voice-first training
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Admin-only assessments
                </li>
              </ul>
              <Link href="/signup" className="btn-secondary w-full py-3">
                Select Plan
              </Link>
            </div>

            <div className="z-10 flex scale-105 flex-col items-center rounded-[14px] border-2 border-[var(--primary)] bg-[var(--surface-container-highest)] p-8 shadow-xl">
              <div className="mb-2 rounded-full bg-[var(--secondary-container)] px-3 py-1 text-xs font-semibold text-[var(--on-secondary-container)]">
                Most Popular
              </div>
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                Professional
              </div>
              <div className="mb-6 font-[family-name:var(--font-headline)] text-5xl font-bold text-[var(--primary)]">
                $29
                <span className="text-lg font-normal">/mo</span>
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Unlimited sessions
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Full performance reports
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Expanded patient library
                </li>
              </ul>
              <Link href="/signup" className="btn-primary w-full py-3 shadow-lg">
                Get Started
              </Link>
            </div>

            <div className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8">
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                Institution
              </div>
              <div className="mb-6 mt-2 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
                Custom
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Supervisor dashboards
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Custom case creation
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                    check_circle
                  </span>
                  Enterprise support
                </li>
              </ul>
              <Link href="/signup" className="btn-secondary w-full py-3">
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-6 py-16 md:px-8">
          <h2 className="mb-10 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group cursor-pointer rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6"
              >
                <summary className="flex list-none items-center justify-between font-bold text-[var(--primary)]">
                  {item.q}
                  <span className="material-symbols-outlined transition group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <p className="mt-4 text-[var(--on-surface-variant)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface-container-low)] pb-8 pt-16">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-4 md:px-8">
          <div>
            <div className="mb-4 font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]">
              VPsych
            </div>
            <p className="max-w-xs text-sm text-[var(--on-surface-variant)]">
              Clinical excellence in every interaction. Empowering the next
              generation of mental health professionals through AI simulation.
            </p>
          </div>
          <div>
            <h5 className="mb-4 font-bold text-[var(--primary)]">Product</h5>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#features" className="hover:text-[var(--primary)]">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[var(--primary)]">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-bold text-[var(--primary)]">Resources</h5>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#faq" className="hover:text-[var(--primary)]">
                  FAQ
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-[var(--primary)]">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-bold text-[var(--primary)]">Company</h5>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#about" className="hover:text-[var(--primary)]">
                  About Us
                </a>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[var(--primary)]">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1280px] flex-col items-center justify-between gap-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] px-6 pt-6 md:flex-row md:px-8">
          <p className="text-xs text-[var(--on-surface-variant)] opacity-70">
            © {new Date().getFullYear()} VPsych. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
