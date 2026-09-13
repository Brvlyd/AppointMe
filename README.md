# AppointMe!

A timezone-aware appointment scheduling app. Users log in with just a username, set a
preferred IANA timezone, create appointments, and invite other users — every time is
converted and displayed in the viewer's own timezone, and an appointment can only be
scheduled inside working hours (08:00–17:00) for every participant, creator included.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), full-stack |
| Language | TypeScript |
| Database | PostgreSQL 17 (via Docker) |
| ORM | Prisma 7.10.0 (`@prisma/adapter-pg` driver adapter) |
| Timezone / datetime | Luxon |
| Auth | JWT (minimal payload) in an httpOnly cookie |
| Validation | Zod |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Tests | Vitest |

Architecture is layered, one direction only: `app/api/*/route.ts` (controller, thin) →
`lib/services/*` (business logic) → `lib/repositories/*` (Prisma queries) → `lib/db.ts`
(the only file that touches Prisma directly).

## Prerequisites

- **Node 22.23.2** — pinned via [Volta](https://volta.sh) (`package.json`'s `volta` field)
  and via `.nvmrc` if you use nvm instead. With Volta installed, `cd` into the project and
  the right Node version activates automatically.
- **Docker Desktop** — runs Postgres locally, no native Postgres install needed.

## Setup (from a fresh clone)

```bash
# 1. Copy the example env file first - `npm install`'s postinstall hook runs
#    `prisma generate`, which needs DATABASE_URL to be *set* (not necessarily
#    reachable yet) just to load its config. Doing this after `npm install`
#    makes the install itself fail.
cp .env.example .env
# then edit .env and replace JWT_SECRET with your own value, e.g.:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Install dependencies (this also runs `prisma generate` via postinstall)
npm install

# 3. Start Postgres in Docker
docker compose up -d
docker compose ps   # wait until appointme-db shows "healthy"

# 4. Apply the database schema
npx prisma migrate deploy

# 5. Seed sample data (5 users across 4 timezones, 2 sample appointments)
npx prisma db seed

# 6. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

**Note on ports:** Postgres runs on host port **5433**, not the default 5432 — this avoids
clashing with a native Postgres install some machines already have running on 5432. If
`docker compose up` fails to bind, something else on your machine is already using 5433;
change the left side of the `"5433:5432"` mapping in `docker-compose.yml` and update
`DATABASE_URL` in `.env` to match.

## Test login accounts (seeded)

Login is username-only, no password. Use any of:

| Username | Timezone |
|---|---|
| `dewi` | Asia/Jakarta |
| `liam` | Pacific/Auckland |
| `oliver` | Europe/London |
| `sarah` | America/New_York |
| `bravely` | Asia/Jakarta |

There is no self-registration — the brief's login form has no field for name/timezone, so
an unrecognized username is rejected (`401`) rather than auto-creating an account.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string. Matches `docker-compose.yml`'s credentials and the `5433` host port by default. |
| `JWT_SECRET` | Secret used to sign/verify session JWTs. Generate your own (see setup step 2) — never reuse the placeholder in `.env.example`. |

## Running tests

```bash
npm test
```

Covers `lib/time.ts` (the timezone/working-hours logic) — wall-clock↔UTC conversion, DST
spring-forward/fall-back behavior, working-hours validation across zones, and the
documented correction to the brief's own Jakarta↔Auckland "non-overlap" example (see
`docs/ASSIGNMENT.md` section 5 and `docs/PROGRESS.md` for that finding).

## Building for production

```bash
npm run build
npm start
```

## Project structure

```
app/
  api/                  API route handlers (thin controllers)
  (protected)/           Route group: shared auth-checking layout + navbar
    appointments/        List + create pages
    profile/              Name/timezone settings
  login/                Public login page
lib/
  services/             Business logic
  repositories/         Prisma queries only
  validators/           Zod schemas
  time.ts               Pure timezone/working-hours logic (server + client)
  db.ts                 PrismaClient singleton (only file that imports Prisma)
components/             UI components (shadcn primitives in components/ui/)
prisma/                 schema.prisma, migrations, seed.ts
docs/                   Working notes: ASSIGNMENT.md, PROGRESS.md (phase-by-phase log)
```

## Documented assumptions

- **Working hours: 08:00–17:00.** The brief states two different numbers (09:00 in one
  section, 08:00 in another); 08:00 was chosen as the more specific, implementation-level
  value. See `docs/ASSIGNMENT.md` section 5.
- **An appointment cannot span more than one calendar day** in any participant's local
  timezone (rejected as a validation error, not silently truncated).
- **Timezones are IANA zone names**, never raw UTC offsets, specifically because offsets
  break across DST transitions.

See `answers.md` for the full reasoning behind the timezone conflict handling, database
indexing choices, and session design.
