"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { segment: "tree", label: "Tree" },
  { segment: "people", label: "People" },
  { segment: "members", label: "Members" },
  { segment: "claims", label: "Claims", managerOnly: true },
  { segment: "activity", label: "Activity", managerOnly: true },
  { segment: "settings", label: "Settings" },
];

export function FamilyNav({
  familyId,
  canManage,
}: {
  familyId: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const base = `/families/${familyId}`;

  return (
    <nav
      aria-label="Workspace"
      className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {links
        .filter((link) => !link.managerOnly || canManage)
        .map((link) => {
          const href = `${base}/${link.segment}`;
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (link.segment === "tree" && pathname === base);
          return (
            <Link
              key={link.segment}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
