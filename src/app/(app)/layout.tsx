import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
