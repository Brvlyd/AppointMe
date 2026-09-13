import { db } from "@/lib/db";

const userSummarySelect = {
  id: true,
  name: true,
  username: true,
  preferredTimezone: true,
} as const;

const appointmentInclude = {
  creator: { select: userSummarySelect },
  participants: {
    select: {
      userId: true,
      user: { select: userSummarySelect },
    },
  },
} as const;

/**
 * Appointments the user is either the creator of or invited to, upcoming only
 * (start >= now). Uses a single query with `include` for creator + participants
 * (no per-row follow-up fetches), plus a paired count query for pagination.
 */
export async function listForUser({
  userId,
  skip,
  take,
}: {
  userId: string;
  skip: number;
  take: number;
}) {
  const where = {
    start: { gte: new Date() },
    OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
  };

  const [appointments, total] = await db.$transaction([
    db.appointment.findMany({
      where,
      skip,
      take,
      orderBy: { start: "asc" },
      include: appointmentInclude,
    }),
    db.appointment.count({ where }),
  ]);

  return { appointments, total };
}

export function create(data: {
  title: string;
  description?: string;
  creatorId: string;
  start: Date;
  end: Date;
  participantUserIds: string[];
}) {
  return db.appointment.create({
    data: {
      title: data.title,
      description: data.description,
      creatorId: data.creatorId,
      start: data.start,
      end: data.end,
      participants: {
        create: data.participantUserIds.map((userId) => ({ userId })),
      },
    },
    include: appointmentInclude,
  });
}
