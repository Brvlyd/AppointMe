# answers.md

## 1. Timezone Conflicts

All timezone logic lives in one file, `lib/time.ts`, used identically on the server (API
validation) and the client (live preview in the create form) — there is exactly one
implementation, not two that could drift apart.

**Storage and conversion.** Every `Appointment.start`/`end` is stored as `timestamptz` in
Postgres (an absolute UTC instant, not a naive timestamp). A user's `preferredTimezone` is
an IANA zone name (e.g. `Asia/Jakarta`), never a raw offset — offsets break the moment DST
shifts, IANA names don't. `localWallTimeToUtc(localIso, zone)` interprets a naive
"YYYY-MM-DDTHH:mm" string (what a `<input type="datetime-local">` produces) as wall-clock
time *in the creator's own zone*, and converts it to UTC for storage. On display,
`formatTimeParts`/`formatInZone` do the reverse: convert the stored UTC instant into
*the currently logged-in viewer's* zone, not the creator's — verified explicitly: the same
appointment shows `16:00 (Asia/Jakarta)` to one logged-in user and `10:00 (Europe/London)`
to another, same underlying instant.

**Working-hours conflicts.** `validateAppointmentWindow(utcStart, utcEnd, zones)` checks a
proposed slot against every participant's zone at once — creator included, since the
creator is functionally a participant in their own meeting even though they don't get a row
in `AppointmentParticipant` (that table models *invitees*; the creator relationship is
`Appointment.creatorId` directly). Two zone-independent facts are checked once, up front:
the end must be after the start, and (see "additional decision" below) the window can't be
in the past or absurdly far in the future. Per-zone, two things are checked: the slot must
fall entirely within 08:00–17:00 local time, and start/end must land on the *same calendar
day* locally — an appointment can't span more than one day. Zones are de-duplicated before
the per-zone loop; without that, a creator and an invitee sharing a zone (both in
`Asia/Jakarta`, say) would produce the identical violation twice.

**Correction to the brief itself.** Section 5 of the client brief cites Asia/Jakarta ↔
Pacific/Auckland as an example with "no common working-hours slot". That's not actually
true: Jakarta is UTC+7 and Auckland is UTC+13 in October (NZDT) — only a 6-hour gap, which
is *narrower* than the 9-hour (08:00–17:00) window, so a common slot must exist by pure
arithmetic. A unit test (`lib/time.test.ts`) proves it: 08:00–11:00 in Jakarta is exactly
14:00–17:00 in Auckland, valid for both. The actual zero-overlap pair among the app's own
seed users is Jakarta ↔ America/New_York (an 11-hour gap, wider than any 9-hour window) —
that's the pair the tests use to cover the "genuinely no common slot" requirement, and both
findings are documented in `docs/ASSIGNMENT.md` and `docs/PROGRESS.md` rather than silently
fixed by swapping the brief's example.

**DST.** Luxon + IANA zone data handles the actual date math correctly across a DST
boundary, but two edge cases needed explicit, tested decisions rather than being left to
"probably fine":
- **Spring-forward gap** — a wall-clock time that never occurs (e.g. `02:30` on the day US
  clocks jump from 02:00 to 03:00). Luxon doesn't reject this; it silently resolves it using
  the offset *in effect just before* the jump. `lib/time.test.ts` asserts this exact
  behavior with a comment explaining it, rather than letting it "happen to work" untested.
- **Fall-back ambiguity** — a wall-clock time that occurs *twice* (e.g. `01:30` when US
  clocks fall back). Luxon picks the first occurrence. Also asserted explicitly.

**Cross-midnight, why rejected rather than allowed:** the brief doesn't require multi-day
appointments, and allowing them opens exactly the ambiguity this project is meant to avoid
— e.g. "23:00 to 01:00" spans a date boundary that reads differently depending on which
day's working-hours window you check it against. Rejecting it (with a message naming the
actual dates on both sides, e.g. "start (22 Oct) and end (31 Oct) fall on different days")
keeps the working-hours rule unambiguous: a single calendar day, in each participant's own
zone, or it's invalid. If a real product needed multi-day events, that would be a
deliberately separate feature with its own rules, not an accidental side effect of loose
validation.

**Additional decision found during manual testing, not in the original design:** a mistyped
date field (a user typed a year like `0111` instead of `2026`) produced a technically valid
ISO date that was simply *wrong*, and since nothing checked "is this appointment actually
in the future", it silently saved and then looked like a disappearing-appointment bug (it
was correctly excluded from the "upcoming" list, just not from creation). Fixed by adding
`start-in-the-past` and `too-far-in-future` (capped at ~2 years) checks to
`validateAppointmentWindow` itself — the same function both the server and the live client
preview call — plus native `min`/`max` bounds on the date pickers as a first line of
defense, not the authoritative one.

## 2. Database Optimization

Indexes exist on every column the query patterns actually filter or join on:
`User.username` (unique, used on every login lookup), `Appointment.creatorId` and
`Appointment.start` (used together by the "my upcoming appointments" query — filter by
`start >= now()`, sorted by `start`, for a user who is either the creator or an invitee),
and `AppointmentParticipant.userId`. That last one is easy to miss: `AppointmentParticipant`
has a composite primary key on `(appointmentId, userId)`, which Postgres can use
efficiently for lookups *starting from* `appointmentId` — but the "which appointments is
this user invited to" query starts from `userId`, the second column, which a composite PK
doesn't serve efficiently. Without the explicit `@@index([userId])`, that half of the
"upcoming appointments" query would silently degrade to a full scan as the table grows.

**No N+1, proven rather than assumed.** `listForUser()` was checked by literally enabling
Prisma's query logging (`log: ["query"]`) and reading the generated SQL, not by reasoning
about it in the abstract. The result was more nuanced than "it's one JOIN": Prisma's current
client (with the `@prisma/adapter-pg` driver adapter) doesn't compile `include` into a
single SQL JOIN by default — it batches relation fetches into separate `SELECT ... WHERE id
IN (...)` queries. For a page of appointments, that's roughly five queries total (the main
`Appointment` list, one batched `User` fetch for creators, one batched
`AppointmentParticipant` fetch, one batched `User` fetch for participants, plus a `COUNT`
for pagination) — but critically, that count stays *constant* regardless of how many
appointments are on the page, because every one of those follow-up queries uses `IN (...)`
across all the IDs from the first query at once, rather than looping and re-querying per
row. That's the actual definition of "no N+1" — Prisma just satisfies it via batching
instead of a literal JOIN. (There's an opt-in `relationLoadStrategy: 'join'` if a literal
JOIN were ever required, e.g. for a single round-trip to a remote DB replica, but nothing
here needed it.)

**Pagination** on both list endpoints (`GET /api/users`, `GET /api/appointments`) uses
`skip`/`take` with a capped `pageSize` (max 50), paired with a `count()` in the same
`$transaction` as the `findMany()` so the total and the page are consistent with each other
without a second round-trip.

## 3. Additional Features

**Real authentication would be priority #1, before anything else listed here.** The current
login is username-only with no password or credential of any kind — knowing a valid
username is the entire authentication requirement, by the brief's own design ("Login with
username only — no password field anywhere"). That's fine as a deliberate constraint for
this exercise, but it means anyone who knows (or guesses) `dewi` is logged in as Dewi with
no further check. For a real product this would need actual credentials — password with
proper hashing (argon2/bcrypt), or better, passwordless auth via a one-time code sent to a
verified email/phone (OTP), which also sidesteps password-reuse and phishing risks that
plain passwords carry. This isn't a nice-to-have; it's the one gap that makes the current
system unsuitable to expose beyond a trusted demo.

Beyond that, roughly in the order I'd actually build them:

- **Editing and cancelling appointments.** Right now appointments are create-only —
  no update, no cancel, no "decline this invite" for a participant. This is a large gap for
  a scheduling tool specifically (plans change), and is a natural extension of the layered
  architecture already in place (a new service method + route, reusing the same
  `validateAppointmentWindow`).
- **Notifications** — an invitee currently only finds out about an appointment by opening
  the app. Email or push notification on invite/change/cancel would make the "invite other
  users" feature actually useful in practice rather than something you have to remember to
  check for.
- **Suggested times when a slot doesn't work for everyone.** The app currently detects and
  explains a working-hours conflict (per the rubric's "handled or acknowledged" bar) but
  doesn't help resolve it. Given all participants' zones, it's straightforward to compute
  and suggest the actual overlapping windows (as `lib/time.ts`'s per-zone check already
  proves exist or don't, per participant) rather than leaving the creator to guess-and-check
  by hand.
- **Profile photo.** Came up directly while building the profile settings page (name +
  timezone) — deliberately deferred because it needs real file upload handling and
  persistent object storage (S3/Cloudinary; local disk doesn't survive most deployment
  targets), which is meaningfully more infrastructure than anything else in this app, for a
  feature that's cosmetic rather than functional.

## 4. Session Management

The JWT payload is deliberately minimal: `{ sub, iat, exp }` — the user's id and the two
timestamps the `jsonwebtoken` library manages itself. No name, timezone, or role rides
along, so nothing about the token becomes stale if the user later changes their profile (as
they now can, via the settings page) and there's nothing worth extracting from a stolen
token beyond "which user id" — no PII. Anything else the app needs about the user (name,
timezone) is fetched fresh from the database on each request via `getCurrentUser()`, wrapped
in React's `cache()` so that a layout's auth check and a page's own data fetch in the same
request don't cause a duplicate DB round-trip.

**Expiry is enforced server-side, not just implied by a cookie setting.** The cookie itself
carries `httpOnly` (inaccessible to JS, so an XSS payload can't read or exfiltrate it),
`sameSite=lax` (blocks it being sent on a cross-site POST, which is most of what CSRF
protection needs here without a separate CSRF token), and `secure` gated to production only
(so local HTTP dev still works) — but the cookie's own `maxAge` is just browser-side
housekeeping so a stale cookie eventually gets swept. The actual enforcement is
`jwt.verify()`'s own check of the `exp` claim, run inside `verifyToken()` on *every*
protected request, wrapped in a try/catch that turns `TokenExpiredError` (and any other
verification failure — bad signature, malformed token) into a clean `null` rather than an
uncaught exception. This was tested directly rather than assumed: a token manually signed
with a `-1h` expiry, using the real secret, was rejected by `/api/auth/me` (401) and by the
protected page (redirects to `/login`) exactly the same as if a full hour had actually
passed — because `jwt.verify()` only ever compares `exp` against the current clock, it has
no notion of "how it got old", so this is the correct, deterministic way to test a 1-hour
expiry without waiting an hour.

One gap this surfaced during testing that's worth naming explicitly: a layout-level auth
check does *not* reliably re-run on Next.js client-side navigation between sibling pages
under the same layout — so a session that goes stale mid-visit (its underlying user id no
longer valid) could crash a page instead of redirecting, if the layout were the only check.
The fix was to check `getCurrentUser()` again in each individual page, not only the shared
layout — slightly less DRY, but the correct place for an authorization check per Next.js's
own guidance, and confirmed by reproducing the exact failure before the fix and its absence
after.
