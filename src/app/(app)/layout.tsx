import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { loadIsSupervisor } from "@/lib/skill-tests/access";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile } = await requireProfile();
  const isSupervisor = await loadIsSupervisor(supabase, profile.id);
  return (
    <AppShell profile={profile} isSupervisor={isSupervisor}>
      {children}
    </AppShell>
  );
}
