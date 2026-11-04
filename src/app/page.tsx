import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Kinship — a private family tree",
  description:
    "A private, invitation-only place for your family to preserve its people, relationships, and stories.",
};

const features = [
  {
    icon: GitBranch,
    title: "Real relationships",
    body: "Biological, adoptive, legal, foster, and step parentage; partnerships with history; guardianship kept separate from parentage.",
  },
  {
    icon: Search,
    title: "Find anyone, fast",
    body: "Search every name and alternate spelling, then focus the tree on the person you are looking for.",
  },
  {
    icon: Users,
    title: "Built to collaborate",
    body: "Invite relatives with the right level of access. Owners, admins, contributors, and viewers each see only what they should.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Row-level security, hashed invitations, and no public tree links. Your family's information stays inside the family.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Brand />
        <nav className="flex items-center gap-2" aria-label="Main">
          {user ? (
            <Button asChild>
              <Link href="/dashboard">
                Open dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 paper-grain opacity-60" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pt-16 pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/6 px-3 py-1 text-xs font-medium text-primary">
                <LockKeyhole className="size-3.5" />
                Private, invitation-only
              </p>
              <h1 className="mt-6 font-heading text-5xl leading-[1.02] font-semibold text-balance sm:text-6xl">
                Hold the whole family story in one place.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Kinship is a collaborative family tree for the people you know and
                the ancestors you are still discovering. No accounts for the
                people in your tree — just careful records, shared with the family.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href={user ? "/dashboard" : "/signup"}>
                    {user ? "Go to your workspaces" : "Start your family tree"}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-5">
                  <Link href="/login">I have an invitation</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Invitations are required to join an existing family workspace.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md" aria-hidden>
              <div className="absolute -inset-8 rounded-full bg-primary/5 blur-3xl" />
              <div className="relative rounded-2xl border border-border bg-card p-4 shadow-[0_24px_80px_-40px_rgba(40,50,35,0.45)]">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div>
                    <p className="font-heading text-lg font-medium">The Rivera Family</p>
                    <p className="text-xs text-muted-foreground">3 generations · 9 people</p>
                  </div>
                  <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
                    Private
                  </span>
                </div>
                <div className="relative mt-6 grid grid-cols-3 gap-3">
                  <div className="col-start-2 rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="mx-auto size-8 rounded-full bg-primary/10" />
                    <p className="mt-2 text-xs font-medium">Abuela</p>
                    <p className="text-[10px] text-muted-foreground">1931 – 2018</p>
                  </div>
                  <div className="col-start-1 mt-6 rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="mx-auto size-8 rounded-full bg-chart-2/20" />
                    <p className="mt-2 text-xs font-medium">Mamá</p>
                    <p className="text-[10px] text-muted-foreground">Born 1958</p>
                  </div>
                  <div className="col-start-3 mt-6 rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="mx-auto size-8 rounded-full bg-chart-3/20" />
                    <p className="mt-2 text-xs font-medium">Tío</p>
                    <p className="text-[10px] text-muted-foreground">Born 1961</p>
                  </div>
                  <div className="col-start-2 mt-1 rounded-xl border border-primary/30 bg-primary/5 p-3 text-center shadow-sm">
                    <div className="mx-auto size-8 rounded-full bg-primary/15" />
                    <p className="mt-2 text-xs font-medium">You</p>
                    <p className="text-[10px] text-muted-foreground">Born 1989</p>
                  </div>
                  <svg
                    className="pointer-events-none absolute inset-0 -z-10 size-full text-border"
                    aria-hidden
                  >
                    <path
                      d="M50% 12% V24% M18% 36% H82% M50% 24% V36% M18% 44% V58% M82% 44% V58% M50% 36% V66%"
                      stroke="currentColor"
                      strokeWidth="1"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Partnership</span>
                  <span className="h-px w-10 bg-chart-3/60" />
                  <span>Parentage</span>
                  <span className="h-px w-10 bg-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="bg-background px-6 py-8">
                <feature.icon className="size-5 text-primary" />
                <h2 className="mt-4 text-base font-medium">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              A careful record
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-balance">
              Family history is rarely neat. Your tree should not pretend otherwise.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Record a year when that is all anyone remembers. Mark a relationship
              as ended without erasing it. Keep a guardian separate from a parent.
              Kinship preserves the uncertainty instead of flattening it.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Dates with exact, month, year, approximate, or unknown precision",
                "Multiple parents, partnerships, and names without forced assumptions",
                "Every change attributed in an audit history",
                "Archive records instead of silently destroying history",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Record detail
                </span>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium">
                  Living
                </span>
              </div>
              <div>
                <p className="font-heading text-2xl font-medium">Elena Rivera Hernández</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Born about 1934 · Oaxaca, México
                </p>
              </div>
              <div className="space-y-2 border-t border-border/70 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Parentage</span>
                  <span>Biological · Adoptive</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Partnership</span>
                  <span>Married 1954 – 1988</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Also known as</span>
                  <span>Elenita</span>
                </div>
              </div>
              <p className="rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
                &ldquo;She kept every letter the family sent from the city.&rdquo;
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="text-xs text-muted-foreground">
            Private family records, kept with care.
          </p>
        </div>
      </footer>
    </div>
  );
}
