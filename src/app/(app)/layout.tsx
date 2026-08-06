import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return (
    <AppShell profile={profile} therapyRoomEnabled={isTherapyRoomEnabled()}>
      {children}
    </AppShell>
  );
}
