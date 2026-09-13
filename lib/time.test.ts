import { describe, expect, it } from "vitest";
import {
  MAX_ADVANCE_DAYS,
  formatInZone,
  isWithinWorkingHours,
  localWallTimeToUtc,
  validateAppointmentWindow,
} from "./time";

describe("localWallTimeToUtc", () => {
  it("interprets a naive local datetime as wall-clock time in the given zone", () => {
    // 09:00 in Jakarta (UTC+7) is 02:00 UTC
    expect(localWallTimeToUtc("2026-10-05T09:00:00", "Asia/Jakarta").toISOString()).toBe(
      "2026-10-05T02:00:00.000Z"
    );
  });

  it("resolves a spring-forward gap using the pre-transition offset (documented Luxon behavior)", () => {
    // US DST 2026 starts 2026-03-08: local clocks jump 02:00 -> 03:00, so
    // 02:30 never actually occurs on the wall clock that day. Luxon does not
    // reject this - it silently resolves it using the offset in effect just
    // before the jump (EST, UTC-5), not the post-jump offset (EDT, UTC-4).
    const utc = localWallTimeToUtc("2026-03-08T02:30:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("resolves a fall-back ambiguous time using the first (pre-fallback) occurrence", () => {
    // US DST 2026 ends 2026-11-01: 01:30 occurs twice (once in EDT, once in
    // EST). Luxon picks the first occurrence, i.e. the pre-fallback offset
    // (EDT, UTC-4), not the second (EST, UTC-5).
    const utc = localWallTimeToUtc("2026-11-01T01:30:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});

describe("formatInZone", () => {
  it("renders a consistent GMT offset label plus the IANA zone name", () => {
    const instant = new Date("2026-10-05T02:00:00Z");
    expect(formatInZone(instant, "Asia/Jakarta")).toBe("09:00 GMT+07:00 (Asia/Jakarta)");
    expect(formatInZone(instant, "Pacific/Auckland")).toBe("15:00 GMT+13:00 (Pacific/Auckland)");
  });
});

describe("isWithinWorkingHours", () => {
  it("accepts the boundaries 08:00 and 17:00 inclusive", () => {
    expect(isWithinWorkingHours(new Date("2026-10-05T01:00:00Z"), "Asia/Jakarta")).toBe(true); // 08:00 WIB
    expect(isWithinWorkingHours(new Date("2026-10-05T10:00:00Z"), "Asia/Jakarta")).toBe(true); // 17:00 WIB
  });

  it("rejects times just outside the window", () => {
    expect(isWithinWorkingHours(new Date("2026-10-05T00:59:00Z"), "Asia/Jakarta")).toBe(false); // 07:59 WIB
    expect(isWithinWorkingHours(new Date("2026-10-05T10:01:00Z"), "Asia/Jakarta")).toBe(false); // 17:01 WIB
  });
});

describe("validateAppointmentWindow", () => {
  it("rejects end-before-start once, without per-zone noise", () => {
    const start = new Date("2026-10-05T05:00:00Z");
    const end = new Date("2026-10-05T04:00:00Z");
    const result = validateAppointmentWindow(start, end, ["Asia/Jakarta", "Europe/London"]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([{ reason: "end-before-start" }]);
  });

  it("rejects a start time in the past - including garbage years like 0111 from a mistyped year field", () => {
    // Uses Date.now() rather than a fixed year so this doesn't rot as real
    // time passes, unlike the fixed-2026 tests elsewhere in this file.
    const start = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const end = new Date(Date.now() + 60 * 60 * 1000);
    const result = validateAppointmentWindow(start, end, ["Asia/Jakarta"]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([{ reason: "start-in-the-past" }]);

    // The actual bug report: a mistyped year field produced "0111" instead
    // of "2026" - a 4-digit, ISO-8601-valid, but nonsensically old date that
    // slipped through with no year-sanity check at all.
    const yearZero = new Date("0111-02-22T04:00:00Z");
    const result2 = validateAppointmentWindow(
      yearZero,
      new Date("0111-02-22T05:00:00Z"),
      ["Asia/Jakarta"]
    );
    expect(result2.valid).toBe(false);
    expect(result2.violations).toEqual([{ reason: "start-in-the-past" }]);
  });

  it("rejects a start time more than MAX_ADVANCE_DAYS in the future", () => {
    const tooFar = new Date(Date.now() + (MAX_ADVANCE_DAYS + 5) * 24 * 60 * 60 * 1000);
    const result = validateAppointmentWindow(
      tooFar,
      new Date(tooFar.getTime() + 60 * 60 * 1000),
      ["Asia/Jakarta"]
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([{ reason: "too-far-in-future" }]);
  });

  it("passes when the slot is within working hours for every participant", () => {
    // 09:00-10:00 WIB (Asia/Jakarta) = 02:00-03:00 UTC = 14:00-15:00 in Pacific/Auckland (UTC+13 in Oct)
    const start = new Date("2026-10-05T02:00:00Z");
    const end = new Date("2026-10-05T03:00:00Z");
    const result = validateAppointmentWindow(start, end, ["Asia/Jakarta", "Pacific/Auckland"]);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("Jakarta and Auckland actually DO have a 3-hour overlap, contradicting the brief", () => {
    // ASSIGNMENT.md section 5 claims Asia/Jakarta <-> Pacific/Auckland "can have
    // no common working-hours slot", citing it as the non-overlap example. That
    // is not correct: Jakarta is UTC+7, Auckland is UTC+13 in October (NZDT),
    // only a 6-hour gap - narrower than the 9-hour (08:00-17:00) window - so a
    // common slot must exist. 08:00-11:00 Jakarta = 14:00-17:00 Auckland works
    // for both; everything else in the day does not. This test documents the
    // brief's example being wrong rather than silently "fixing" it by deleting
    // the case - see docs/PROGRESS.md for the discrepancy note.
    const overlapStart = new Date("2026-10-05T01:00:00Z"); // 08:00 Jakarta / 14:00 Auckland
    const overlapEnd = new Date("2026-10-05T02:00:00Z"); // 09:00 Jakarta / 15:00 Auckland
    expect(
      validateAppointmentWindow(overlapStart, overlapEnd, ["Asia/Jakarta", "Pacific/Auckland"])
        .valid
    ).toBe(true);

    const outsideStart = new Date("2026-10-05T06:00:00Z"); // 13:00 Jakarta / 19:00 Auckland
    const outsideEnd = new Date("2026-10-05T07:00:00Z");
    expect(
      validateAppointmentWindow(outsideStart, outsideEnd, ["Asia/Jakarta", "Pacific/Auckland"])
        .valid
    ).toBe(false);
  });

  it("detects the real zero-overlap case among our seed users: Jakarta and New York", () => {
    // Jakarta (UTC+7) and America/New_York (UTC-4 in October, EDT) are 11
    // hours apart - wider than any 9-hour working window - so no UTC instant
    // can be inside 08:00-17:00 for both. Swept across a full day to confirm.
    for (let hour = 0; hour < 24; hour++) {
      const start = new Date(Date.UTC(2026, 9, 5, hour, 0, 0));
      const end = new Date(Date.UTC(2026, 9, 5, hour, 30, 0));
      const result = validateAppointmentWindow(start, end, ["Asia/Jakarta", "America/New_York"]);
      expect(result.valid).toBe(false);
    }
  });

  it("reports outside-working-hours per participant with their own local time", () => {
    // 09:00-10:00 WIB works for Jakarta but lands at 22:00-23:00 in New York the previous day - no, same day, just very late.
    const start = new Date("2026-10-05T02:00:00Z");
    const end = new Date("2026-10-05T03:00:00Z");
    const result = validateAppointmentWindow(start, end, ["Asia/Jakarta", "America/New_York"]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      {
        reason: "outside-working-hours",
        zone: "America/New_York",
        localStart: "22:00 GMT-04:00 (America/New_York)",
        localEnd: "23:00 GMT-04:00 (America/New_York)",
      },
    ]);
  });

  it("rejects a window that crosses midnight in a participant's local time", () => {
    // 23:30-00:30 UTC crosses midnight in UTC-adjacent zones like Europe/London (BST, UTC+1 in Oct)
    const start = new Date("2026-10-05T22:45:00Z");
    const end = new Date("2026-10-05T23:15:00Z");
    const result = validateAppointmentWindow(start, end, ["Europe/London"]);
    expect(result.valid).toBe(false);
    expect(result.violations[0].reason).toBe("crosses-midnight");
  });
});
