"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground/60">digest: {error.digest}</p>
      )}
      <Button onClick={reset} variant="outline" className="mt-6">
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
