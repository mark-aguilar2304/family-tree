import type { Parentage, Person } from "@/lib/supabase/database.types";

export type SiblingKind = "full" | "half" | "shared";

export type DerivedSibling = {
  person: Person;
  kind: SiblingKind;
  sharedParentIds: string[];
};

/**
 * Siblings are never stored as edges. They are derived from shared active
 * parentage so a correction to one relationship updates every sibling view.
 */
export function deriveSiblings(
  personId: string,
  parentage: Parentage[],
  people: Person[],
): DerivedSibling[] {
  const active = parentage.filter((edge) => edge.end_date === null);
  const myParents = new Set(
    active.filter((edge) => edge.child_id === personId).map((edge) => edge.parent_id),
  );
  if (myParents.size === 0) return [];

  const parentSets = new Map<string, Set<string>>();
  for (const edge of active) {
    if (edge.child_id === personId) continue;
    const set = parentSets.get(edge.child_id) ?? new Set<string>();
    set.add(edge.parent_id);
    parentSets.set(edge.child_id, set);
  }

  const personById = new Map(people.map((person) => [person.id, person]));
  const siblings: DerivedSibling[] = [];

  for (const [candidateId, candidateParents] of parentSets) {
    const shared = [...myParents].filter((id) => candidateParents.has(id));
    if (shared.length === 0) continue;
    const person = personById.get(candidateId);
    if (!person || person.archived_at) continue;

    const kind: SiblingKind =
      shared.length >= 2
        ? "full"
        : myParents.size >= 2 && candidateParents.size >= 2
          ? "half"
          : "shared";

    siblings.push({ person, kind, sharedParentIds: shared });
  }

  return siblings.sort((a, b) => a.person.display_name.localeCompare(b.person.display_name));
}

export function siblingLabel(kind: SiblingKind): string {
  if (kind === "full") return "Full sibling";
  if (kind === "half") return "Half sibling";
  return "Sibling";
}
