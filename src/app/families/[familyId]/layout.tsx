import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { FamilyNav } from "@/components/family-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireFamily } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { roleLabels } from "@/lib/permissions";

export default async function FamilyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const access = await requireFamily(familyId);

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Brand compact />
            <span className="hidden h-5 w-px bg-border sm:block" />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <ArrowLeft /> Workspaces
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-medium">
                {access.family.name}
              </p>
            </div>
            <Badge variant={access.isOwner ? "default" : "secondary"} className="hidden sm:inline-flex">
              {roleLabels[access.role]}
            </Badge>
            {access.isArchived && (
              <Badge variant="outline" className="gap-1">
                <Archive /> Archived
              </Badge>
            )}
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
              <LogOut />
            </Button>
          </form>
        </div>
        <div className="mx-auto max-w-[1500px] px-3 sm:px-5">
          <FamilyNav familyId={familyId} canManage={access.canManage} />
        </div>
      </header>
      {access.isArchived && (
        <div className="border-b border-amber-500/20 bg-amber-500/8 px-5 py-2 text-center text-sm text-amber-900">
          This workspace is archived and read-only. Only the owner can restore it.
        </div>
      )}
      <main className="mx-auto w-full max-w-[1500px] px-5 py-8">{children}</main>
    </div>
  );
}
