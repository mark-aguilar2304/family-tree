"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function FamilyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
      <h1 className="font-heading text-2xl font-medium">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The workspace may be unavailable, or your connection dropped. Try again.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
