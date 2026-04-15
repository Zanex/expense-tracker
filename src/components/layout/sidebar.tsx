"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { LayoutDashboard, Receipt, Tag, BarChart2, X } from "lucide-react";

// ─── Nav items ────────────────────────────────────────────

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Spese", icon: Receipt },
  { href: "/categories", label: "Categorie", icon: Tag },
  { href: "/reports", label: "Report", icon: BarChart2 },
];

// ─── Nav content (riusabile in desktop e mobile) ──────────

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Preserviamo mese e anno nei link di navigazione
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  function getHrefWithParams(baseHref: string) {
    if (!month && !year) return baseHref;
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    return `${baseHref}?${params.toString()}`;
  }

  return (
    <>
      <div className="mb-6 px-3 py-2">
        <h1 className="text-lg font-bold tracking-tight">💰 Expense Tracker</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullHref = getHrefWithParams(href);
          return (
            <Link
              key={href}
              href={fullHref}
              onClick={onNavigate}
              onMouseEnter={() => router.prefetch(href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

// ─── Component ───────────────────────────────────────────

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar — visibile da md in su */}
      <aside className="hidden h-screen w-60 flex-col border-r border-border/40 bg-background/60 backdrop-blur-md px-3 py-4 md:flex">
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onMobileClose}
          />
          {/* Pannello */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl px-3 py-4 shadow-2xl md:hidden">
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent onNavigate={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
}
