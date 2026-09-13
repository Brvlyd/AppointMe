import { DateTime } from "luxon";

export const WORKING_HOURS = { start: 8, end: 17 } as const;

/**
 * Interprets `localIso` (a naive datetime with no offset, e.g. "2026-10-05T14:00")
 * as wall-clock time in `zone`, and returns the equivalent UTC instant.
 */
export function localWallTimeToUtc(localIso: string, zone: string): Date {
  const dt = DateTime.fromISO(localIso, { zone });
  if (!dt.isValid) {
    throw new Error(
      `Invalid local datetime "${localIso}" for zone "${zone}": ${dt.invalidExplanation}`
    );
  }
  return dt.toUTC().toJSDate();
}

/**
 * Renders a UTC instant in `zone` as "HH:mm GMT±HH:mm (Zone/Name)".
 * Uses a fixed GMT+offset label instead of Intl's short zone name because the
 * latter is inconsistent across zones (e.g. "WIB" for Asia/Jakarta but just
 * "GMT+13" for Pacific/Auckland) - the offset format is uniform everywhere,
 * and the IANA zone name in parentheses is what actually disambiguates.
 */
export function formatInZone(utcInstant: Date, zone: string): string {
  const { time, zoneLabel } = formatTimeParts(utcInstant, zone);
  return `${time} ${zoneLabel}`;
}

/**
 * Same rendering as `formatInZone`, but as separate pieces - for UI that
 * needs to style the time and the zone label differently (e.g. a large bold
 * time with a smaller label underneath) instead of one combined string.
 */
export function formatTimeParts(utcInstant: Date, zone: string): { time: string; zoneLabel: string } {
  const dt = DateTime.fromJSDate(utcInstant, { zone: "utc" }).setZone(zone);
  return {
    time: dt.toFormat("HH:mm"),
    zoneLabel: `GMT${dt.toFormat("ZZ")} (${zone})`,
  };
}

/** Whether the instant's local time-of-day in `zone` falls within WORKING_HOURS. */
export function isWithinWorkingHours(utcInstant: Date, zone: string): boolean {
  const dt = DateTime.fromJSDate(utcInstant, { zone: "utc" }).setZone(zone);
  const minutesOfDay = dt.hour * 60 + dt.minute;
  return (
    minutesOfDay >= WORKING_HOURS.start * 60 && minutesOfDay <= WORKING_HOURS.end * 60
  );
}

export type AppointmentViolation =
  | { reason: "end-before-start" }
  | { reason: "crosses-midnight"; zone: string; localStart: string; localEnd: string }
  | { reason: "outside-working-hours"; zone: string; localStart: string; localEnd: string };

/**
 * Validates a proposed appointment window against every participant's
 * timezone at once. `end-before-start` is a global, zone-independent fact and
 * is checked once up front; everything else is checked per participant so a
 * caller can report exactly who the slot doesn't work for.
 */
export function validateAppointmentWindow(
  utcStart: Date,
  utcEnd: Date,
  participantZones: string[]
): { valid: boolean; violations: AppointmentViolation[] } {
  if (utcEnd <= utcStart) {
    return { valid: false, violations: [{ reason: "end-before-start" }] };
  }

  const violations: AppointmentViolation[] = [];

  for (const zone of participantZones) {
    const localStart = DateTime.fromJSDate(utcStart, { zone: "utc" }).setZone(zone);
    const localEnd = DateTime.fromJSDate(utcEnd, { zone: "utc" }).setZone(zone);
    const localStartLabel = formatInZone(utcStart, zone);
    const localEndLabel = formatInZone(utcEnd, zone);

    if (!localStart.hasSame(localEnd, "day")) {
      violations.push({
        reason: "crosses-midnight",
        zone,
        localStart: localStartLabel,
        localEnd: localEndLabel,
      });
      continue;
    }

    if (!isWithinWorkingHours(utcStart, zone) || !isWithinWorkingHours(utcEnd, zone)) {
      violations.push({
        reason: "outside-working-hours",
        zone,
        localStart: localStartLabel,
        localEnd: localEndLabel,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
