"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DateTime } from "luxon";
import { createAppointmentSchema } from "@/lib/validators/appointment";
import {
  MAX_ADVANCE_DAYS,
  localWallTimeToUtc,
  validateAppointmentWindow,
  type AppointmentViolation,
} from "@/lib/time";

type User = { id: string; name: string; username: string; preferredTimezone: string };

export function CreateAppointmentForm({
  currentUser,
  invitableUsers,
  mode = "create",
  appointmentId,
  initialValues,
  backHref,
}: {
  currentUser: User;
  invitableUsers: User[];
  /** "edit" PATCHes an existing appointment instead of POSTing a new one. */
  mode?: "create" | "edit";
  appointmentId?: string;
  initialValues?: {
    title: string;
    description: string;
    start: string;
    end: string;
    participantIds: string[];
  };
  backHref: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [start, setStart] = useState(initialValues?.start ?? "");
  const [end, setEnd] = useState(initialValues?.end ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialValues?.participantIds ?? []
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedParticipants = invitableUsers.filter((u) => participantIds.includes(u.id));

  // Native browser bounds for the pickers - mirrors the same rule enforced in
  // lib/time.ts (no past dates, nothing absurdly far out like a mistyped
  // year). This narrows the picker UI but isn't the authoritative check: a
  // manually-typed value still has to pass validateAppointmentWindow below
  // and the server's own call to it.
  const nowInZone = DateTime.now().setZone(currentUser.preferredTimezone);
  const minDateTime = nowInZone.toFormat("yyyy-MM-dd'T'HH:mm");
  const maxDateTime = nowInZone.plus({ days: MAX_ADVANCE_DAYS }).toFormat("yyyy-MM-dd'T'HH:mm");

  // Live conflict preview, reusing the exact same validation the server runs.
  // Only runs once both start and end are filled with something parseable -
  // otherwise a half-finished form flashes a misleading "end before start".
  // Keeps the parsed UTC instants alongside the violations so messages below
  // can show the actual dates involved, not just an abstract reason code.
  const { violations, utcStart, utcEnd } = useMemo<{
    violations: AppointmentViolation[];
    utcStart: Date | null;
    utcEnd: Date | null;
  }>(() => {
    if (!start || !end) return { violations: [], utcStart: null, utcEnd: null };
    try {
      const utcStart = localWallTimeToUtc(start, currentUser.preferredTimezone);
      const utcEnd = localWallTimeToUtc(end, currentUser.preferredTimezone);
      const zones = [
        currentUser.preferredTimezone,
        ...selectedParticipants.map((u) => u.preferredTimezone),
      ];
      return {
        violations: validateAppointmentWindow(utcStart, utcEnd, zones).violations,
        utcStart,
        utcEnd,
      };
    } catch {
      return { violations: [], utcStart: null, utcEnd: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, currentUser.preferredTimezone, participantIds]);

  const hasTimeViolation = violations.length > 0;

  function participantsInZone(zone: string): string[] {
    const names: string[] = [];
    if (currentUser.preferredTimezone === zone) names.push("you");
    for (const u of selectedParticipants) {
      if (u.preferredTimezone === zone) names.push(u.name);
    }
    return names;
  }

  /**
   * Joins names with proper "and" grammar instead of a flat comma list, so
   * two different people sharing a zone read as "you and Dewi" (clearly two
   * people) rather than "You, Dewi Anggraini" (which can look like one
   * merged label).
   */
  function joinNames(names: string[]): string {
    if (names.length <= 1) return names.join("");
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  /** "In Asia/Jakarta, start (22 Oct 2026) and end (31 Oct 2026) are on different days for you and Dewi Anggraini." */
  function crossesMidnightMessage(zone: string): string {
    const names = joinNames(participantsInZone(zone));
    if (!utcStart || !utcEnd) {
      return `In ${zone}, start and end fall on different days - this affects ${names}.`;
    }
    const startDate = DateTime.fromJSDate(utcStart, { zone: "utc" }).setZone(zone).toFormat("d MMM yyyy");
    const endDate = DateTime.fromJSDate(utcEnd, { zone: "utc" }).setZone(zone).toFormat("d MMM yyyy");
    return `In ${zone}, start (${startDate}) and end (${endDate}) fall on different days - an appointment can't span more than one day. This affects ${names}.`;
  }

  function toggleParticipant(id: string, checked: boolean) {
    setParticipantIds((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = createAppointmentSchema.safeParse({
      title,
      description,
      start,
      end,
      participantUserIds: participantIds,
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    if (violations.length > 0) {
      setFormError("This time doesn't work for every participant - see the warnings below.");
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === "edit" ? `/api/appointments/${appointmentId}` : "/api/appointments";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error ?? `Could not ${mode === "edit" ? "update" : "create"} the appointment`);
        return;
      }

      router.push(mode === "edit" ? `/appointments/${appointmentId}` : "/appointments");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quarterly planning sync"
              aria-invalid={fieldErrors.title ? true : undefined}
            />
            {fieldErrors.title && (
              <p className="text-sm text-destructive">{fieldErrors.title[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any extra context for invitees..."
              rows={3}
              aria-invalid={fieldErrors.description ? true : undefined}
            />
            {fieldErrors.description && (
              <p className="text-sm text-destructive">{fieldErrors.description[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start">Start ({currentUser.preferredTimezone})</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                min={minDateTime}
                max={maxDateTime}
                aria-invalid={fieldErrors.start || hasTimeViolation ? true : undefined}
              />
              {fieldErrors.start && (
                <p className="text-sm text-destructive">{fieldErrors.start[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end">End ({currentUser.preferredTimezone})</Label>
              <Input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                min={minDateTime}
                max={maxDateTime}
                aria-invalid={fieldErrors.end || hasTimeViolation ? true : undefined}
              />
              {fieldErrors.end && <p className="text-sm text-destructive">{fieldErrors.end[0]}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Times are entered in your own timezone ({currentUser.preferredTimezone}) and converted
            for every invitee automatically.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Label>Invite participants</Label>
          {invitableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other users to invite.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {invitableUsers.map((u) => {
                const zoneViolation = violations.find(
                  (v) => "zone" in v && v.zone === u.preferredTimezone
                );
                const isSelected = participantIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition-colors ${
                      isSelected ? "border-primary/40 bg-primary/5" : "border-border"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleParticipant(u.id, checked === true)}
                    />
                    <span className="flex-1 text-sm">
                      {u.name}{" "}
                      <span className="text-muted-foreground">({u.preferredTimezone})</span>
                    </span>
                    {isSelected && zoneViolation && (
                      <span className="text-xs font-medium text-destructive">
                        {zoneViolation.reason === "crosses-midnight"
                          ? "Crosses midnight"
                          : "Outside working hours"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {violations.length > 0 && (
        <div className="flex flex-col gap-2">
          {violations.map((v, i) => (
            <Alert key={i} variant="destructive">
              <AlertDescription>
                {v.reason === "end-before-start" && "End time must be after the start time."}
                {v.reason === "start-in-the-past" && "The start time can't be in the past."}
                {v.reason === "too-far-in-future" &&
                  `The start time is too far in the future (max ${MAX_ADVANCE_DAYS} days ahead) - double-check the date you entered.`}
                {v.reason === "crosses-midnight" && crossesMidnightMessage(v.zone)}
                {v.reason === "outside-working-hours" &&
                  `In ${v.zone}, this time is outside working hours (08:00-17:00) - this affects ${joinNames(participantsInZone(v.zone))}.`}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Could not {mode === "edit" ? "update" : "create"} appointment</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={submitting}
          className="w-fit bg-amber-500 text-white hover:bg-amber-600"
        >
          {submitting
            ? mode === "edit"
              ? "Saving..."
              : "Creating..."
            : mode === "edit"
              ? "Save changes"
              : "Create appointment"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={backHref} />} nativeButton={false}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
