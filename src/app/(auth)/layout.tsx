import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <Brand className="relative text-primary-foreground" />
        <div className="relative max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            Private by invitation
          </p>
          <h1 className="mt-4 font-heading text-5xl leading-[1.05] font-semibold text-balance">
            Every family is a story worth keeping.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-primary-foreground/75">
            Gather names, dates, photographs, and the connections between them in
            one quiet place — built to be shared carefully, with the people who
            belong.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Your family tree is never public. Access is granted one invitation at a
          time.
        </p>
      </section>

      <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            Back to Kinship
          </Link>
        </p>
      </section>
    </main>
  );
}
