import type { Metadata } from "next";
import { QualityLedgerDashboardClient } from "@/components/admin/QualityLedgerDashboardClient";

export const metadata: Metadata = {
  title: "Quality Ledger | VPsych Admin",
  description:
    "Immutable scientific audit trail for every VPsych assessment quality metric.",
};

export default function QualityLedgerAdminPage() {
  return <QualityLedgerDashboardClient />;
}
