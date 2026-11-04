import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5 rounded-md", className)}
      aria-label="Kinship home"
    >
      <span className="relative grid size-9 place-items-center rounded-full border border-primary/25 bg-primary/8">
        <svg viewBox="0 0 24 24" className="size-5 text-primary" aria-hidden>
          <path
            d="M12 3v5M6 21v-4c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v4M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="font-heading text-xl font-semibold tracking-tight">
          Kinship
        </span>
      )}
    </Link>
  );
}
