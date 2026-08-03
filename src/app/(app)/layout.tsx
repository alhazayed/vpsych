import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";

/** Authenticated app shell — private; never index. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
