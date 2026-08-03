import type { Metadata } from "next";
import { MultiLedgerDashboardClient } from "@/components/admin/MultiLedgerDashboardClient";

export const metadata: Metadata = {
  title: "Multi-Ledger Platform | VPsych Admin",
  description:
    "Enterprise Operational, Educational, and Scientific Quality ledgers with cross-ledger correlation and replay.",
};

export default function MultiLedgerAdminPage() {
  return <MultiLedgerDashboardClient />;
}
