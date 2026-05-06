"use client";

import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { CommandPaletteTrigger } from "~/components/ui/command-palette";

// ─── Types ────────────────────────────────────────────────

interface HeaderProps {
  user: Session["user"];
  onMenuClick: () => void;
}

// ─── Component ───────────────────────────────────────────

export function Header({ user, onMenuClick }: HeaderProps) {
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between px-4 md:px-8">
      {/* Hamburger — solo mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo mobile */}
      <span className="text-sm font-bold md:hidden">💰 Expense Tracker</span>

      {/* Centro: barra di ricerca Cmd+K — solo desktop */}
      <div className="hidden md:flex md:flex-1 md:justify-center">
        <CommandPaletteTrigger />
      </div>

      {/* Destra: toggle tema + user menu */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium md:inline">
                  {user?.name}
                </span>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Esci
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}