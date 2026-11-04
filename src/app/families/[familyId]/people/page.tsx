import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page";
import { PersonCard } from "@/components/people/person-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

const PAGE_SIZE = 24;

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { familyId } = await params;
  const query = await searchParams;
  const access = await requireFamily(familyId);
  const q = (query.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: people, error } = await supabase.rpc("search_people", {
    p_family_id: familyId,
    p_query: q,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const results = people ?? [];
  const hasNext = results.length === PAGE_SIZE;

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="People"
        description="Every person in this family tree, whether or not they have an account."
        actions={
          access.canEdit ? (
            <Button asChild>
              <Link href={`/families/${familyId}/people/new`}>
                <UserPlus /> Add person
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form
        action={`/families/${familyId}/people`}
        className="mt-6 flex max-w-xl gap-2"
        role="search"
      >
        <label htmlFor="people-search" className="sr-only">
          Search people
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="people-search"
            name="q"
            defaultValue={q}
            placeholder="Search names, nicknames, alternate spellings…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q && (
          <Button asChild variant="ghost">
            <Link href={`/families/${familyId}/people`}>Clear</Link>
          </Button>
        )}
      </form>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          People could not be loaded. Refresh and try again.
        </p>
      ) : results.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Search className="size-8" />}
            title={q ? "No matching people" : "No people yet"}
            description={
              q
                ? "Try a shorter name or an alternate spelling."
                : "Add the first person to begin this family tree."
            }
            action={
              !q && access.canEdit ? (
                <Button asChild>
                  <Link href={`/families/${familyId}/people/new`}>
                    <UserPlus /> Add the first person
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground" role="status">
            {results.length} {results.length === 1 ? "person" : "people"}
            {q ? ` matching “${q}”` : ""}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((person) => (
              <PersonCard key={person.id} person={person} familyId={familyId} />
            ))}
          </div>
          {(page > 1 || hasNext) && (
            <nav className="mt-8 flex items-center justify-between" aria-label="People pages">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/families/${familyId}/people?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      page: String(page - 1),
                    })}`}
                  >
                    Previous
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">Page {page}</span>
              {hasNext ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/families/${familyId}/people?${new URLSearchParams({
                      ...(q ? { q } : {}),
                      page: String(page + 1),
                    })}`}
                  >
                    Next
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
