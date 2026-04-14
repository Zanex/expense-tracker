import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { DashboardShell } from "~/components/layout/dashboard-shell";
import { CommandPalette } from "~/components/ui/command-palette";
import { Suspense } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <DashboardShell user={session.user}>
      <Suspense fallback={null}>
      {/* Command palette montata qui → disponibile su ogni pagina dashboard */}
      <CommandPalette />
      {children}
      </Suspense>
    </DashboardShell>
  );
}