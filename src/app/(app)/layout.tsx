import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return (
    <AppShell profile={profile} therapyRoomEnabled={isTherapyRoomModeEnabled()}>
      {children}
    </AppShell>
  );
}
