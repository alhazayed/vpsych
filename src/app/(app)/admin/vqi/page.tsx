import type { Metadata } from "next";
import { VqiDashboardClient } from "@/components/admin/VqiDashboardClient";

export const metadata: Metadata = {
  title: "VPsych Quality Index | VPsych Admin",
  description:
    "Master hierarchical quality metric composing CFI, ERI, AVI, ALE, and RRS with versioned weights and provenance.",
};

export default function VqiAdminPage() {
  return <VqiDashboardClient />;
}
