"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error.message || "Could not load your appointments. Please try again."}
        </AlertDescription>
      </Alert>
      <Button onClick={() => reset()} className="w-fit">
        Try again
      </Button>
    </div>
  );
}
