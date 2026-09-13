"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateProfileSchema } from "@/lib/validators/user";

export function ProfileForm({
  currentUser,
  timezones,
}: {
  currentUser: { name: string; username: string; preferredTimezone: string };
  timezones: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(currentUser.name);
  const [preferredTimezone, setPreferredTimezone] = useState(currentUser.preferredTimezone);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    setFieldErrors({});

    const parsed = updateProfileSchema.safeParse({ name, preferredTimezone });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error ?? "Could not update your profile");
        return;
      }

      setSaved(true);
      // Re-renders Server Components (including the navbar) with the fresh
      // name/timezone, without a full logout/login round trip.
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Username</Label>
            <Input value={currentUser.username} disabled />
            <p className="text-xs text-muted-foreground">Username can't be changed.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="preferredTimezone">Preferred timezone</Label>
            <select
              id="preferredTimezone"
              value={preferredTimezone}
              onChange={(e) => setPreferredTimezone(e.target.value)}
              aria-invalid={fieldErrors.preferredTimezone ? true : undefined}
              className="h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {fieldErrors.preferredTimezone && (
              <p className="text-sm text-destructive">{fieldErrors.preferredTimezone[0]}</p>
            )}
            <p className="text-xs text-muted-foreground">
              All your appointment times are shown in this timezone.
            </p>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {saved && !formError && (
            <Alert className="border-success/40 bg-success/10">
              <AlertDescription className="text-success">Profile updated.</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-fit bg-amber-500 text-white hover:bg-amber-600"
          >
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
