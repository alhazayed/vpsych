import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getTranslations } from "next-intl/server";
import { PACKAGE_VERSION, STAGE12_CERT_ID } from "@/lib/ops/versions";
import { headers } from "next/headers";

type HealthTone = "active" | "warning" | "inactive" | "info" | "neutral";

async function probeAppHealth(): Promise<{
  ok: boolean;
  checkedAt: string | null;
  version: string | null;
}> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (!host) {
      return { ok: true, checkedAt: new Date().toISOString(), version: PACKAGE_VERSION };
    }
    const res = await fetch(`${proto}://${host}/api/health`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, checkedAt: new Date().toISOString(), version: null };
    }
    const body = (await res.json()) as {
      ok?: boolean;
      version?: string;
      checkedAt?: string;
    };
    return {
      ok: Boolean(body.ok),
      checkedAt: body.checkedAt ?? new Date().toISOString(),
      version: body.version ?? PACKAGE_VERSION,
    };
  } catch {
    return { ok: false, checkedAt: new Date().toISOString(), version: null };
  }
}

export default async function AdminDiagnosticsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.diagnostics");
  const tHome = await getTranslations("admin.home");
  const health = await probeAppHealth();

  const services: Array<{
    name: string;
    status: string;
    tone: HealthTone;
    detail: string;
  }> = [
    {
      name: t("svcApplication"),
      status: health.ok ? t("statusOperational") : t("statusUnavailable"),
      tone: health.ok ? "active" : "warning",
      detail: health.checkedAt
        ? t("lastChecked", {
            time: new Date(health.checkedAt).toLocaleString(),
          })
        : t("statusUnknown"),
    },
    {
      name: t("svcAuth"),
      status: t("statusOperational"),
      tone: "active",
      detail: t("authDetail"),
    },
    {
      name: t("svcAi"),
      status: t("statusCheckViaLink"),
      tone: "info",
      detail: t("aiDetail"),
    },
  ];

  const links = [
    { href: "/admin/cidp", label: t("operations") },
    { href: "/admin/supervisor", label: t("supervisorFramework") },
    { href: "/admin/personality", label: t("legacyPersonality") },
    { href: "/api/health", label: t("health"), external: true },
    { href: "/api/health/openai", label: t("openaiHealth") },
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />

      <section className="clinical-card mb-6 space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("healthTitle")}
          </h2>
          <p className="font-mono text-xs text-[var(--on-surface-variant)]">
            v{health.version ?? PACKAGE_VERSION} · {STAGE12_CERT_ID}
          </p>
        </div>
        <ul className="space-y-3">
          {services.map((s) => (
            <li
              key={s.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--on-surface)]">
                  {s.name}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {s.detail}
                </p>
              </div>
              <StatusBadge label={s.status} tone={s.tone} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--on-surface-variant)]">
          {t("healthDisclaimer")}
        </p>
      </section>

      <section className="clinical-card space-y-3 p-5">
        <p className="text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <AdvancedDetails title={t("engineNames")}>
          <ul className="list-disc space-y-1 ps-5 text-xs text-[var(--on-surface-variant)]">
            <li>ACE — Adaptive Curriculum (Learners &amp; Progress)</li>
            <li>CGE — Competency Graph (Competencies)</li>
            <li>CIDP — Controlled Institutional Deployment (Operations)</li>
            <li>VQI / AVI / CFI / ERI / RRS — scientific index APIs</li>
          </ul>
        </AdvancedDetails>
      </section>
    </main>
  );
}
