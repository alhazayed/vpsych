import { AppHeader } from "@/components/AppHeader";
import { requireProfile } from "@/lib/auth";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      {children}
    </div>
  );
}
