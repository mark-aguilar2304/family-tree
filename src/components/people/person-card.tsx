import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { lifeDates } from "@/lib/dates";
import { lifeStatusLabels } from "@/lib/permissions";
import type { Person } from "@/lib/supabase/database.types";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonCard({
  person,
  familyId,
}: {
  person: Person;
  familyId: string;
}) {
  return (
    <Link
      href={`/families/${familyId}/people/${person.id}`}
      className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-card/80"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/8 font-heading text-sm font-semibold text-primary">
        {initials(person.display_name) || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium group-hover:text-primary">
            {person.display_name}
          </span>
          {person.is_claimed && <Badge variant="secondary">Linked</Badge>}
          {person.archived_at && <Badge variant="outline">Archived</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {lifeDates(person)}
        </span>
        <span className="mt-2 block text-xs text-muted-foreground">
          {lifeStatusLabels[person.life_status]}
          {person.birth_place ? ` · ${person.birth_place}` : ""}
        </span>
      </span>
    </Link>
  );
}
