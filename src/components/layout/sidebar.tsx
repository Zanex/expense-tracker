"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { LayoutDashboard, Receipt, Tag, BarChart2, Plane, X, TrendingUp, Car } from "lucide-react";

// ─── Nav items ────────────────────────────────────────────

const navItems = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/expenses",     label: "Spese",        icon: Receipt },
  { href: "/trips",        label: "Viaggi",       icon: Plane },
  { href: "/vehicle",      label: "Veicolo",      icon: Car },
  { href: "/investments",  label: "Investimenti", icon: TrendingUp },
  { href: "/categories",   label: "Categorie",    icon: Tag },
  { href: "/reports",      label: "Report",       icon: BarChart2 },
];

// ─── Nav content ─────────────────────────────────────────

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const month = searchParams.get("month");
  const year = searchParams.get("year");

  function getHrefWithParams(baseHref: string) {
    // Preserva mese/anno solo per le pagine che lo usano
    const usesMonthFilter = ["/dashboard", "/expenses", "/reports"].includes(baseHref);
    if (!usesMonthFilter || (!month && !year)) return baseHref;
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
          // Gestisce match anche per sotto-route (es. /trips/[id])
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={fullHref}
              onClick={onNavigate}
              onMouseEnter={() => router.prefetch(href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
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
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-60 flex-col border-r bg-background px-3 py-4 md:flex">
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background px-3 py-4 shadow-xl md:hidden">
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
