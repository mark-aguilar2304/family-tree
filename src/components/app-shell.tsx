import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { email?: string | null; fullName?: string | null };
}) {
  const displayName = user.fullName || user.email || "Your account";
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <Brand />
            <nav aria-label="Account" className="hidden sm:block">
              <Link
                href="/dashboard"
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Workspaces
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(displayName)}
              </span>
              <span className="max-w-48 truncate text-sm">{displayName}</span>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
