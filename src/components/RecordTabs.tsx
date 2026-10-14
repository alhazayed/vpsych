import Link from "next/link";
import { getTranslations } from "next-intl/server";

const TABS = [
  { key: "training", href: "/training", label: "training" },
  { key: "sessions", href: "/sessions", label: "mySessions" },
] as const;

/**
 * Case file folder tabs over the trainee's two records: training progress and
 * sessions. The open tab is the current page; the other one links to it. The
 * sheet below takes `cf-sheet` so it joins the first tab.
 */
export async function RecordTabs({
  current,
}: {
  current: (typeof TABS)[number]["key"];
}) {
  const t = await getTranslations("nav");
  return (
    <nav aria-label={t("recordTabs")} className="flex items-end gap-1">
      {TABS.map((tab) =>
        tab.key === current ? (
          <span key={tab.key} aria-current="page" className="cf-tab cf-tab--open">
            {t(tab.label)}
          </span>
        ) : (
          <Link key={tab.key} href={tab.href} className="cf-tab">
            {t(tab.label)}
          </Link>
        ),
      )}
    </nav>
  );
}
