import { db } from "@/lib/db";

export function findByUsername(username: string) {
  return db.user.findUnique({ where: { username } });
}

export function findById(id: string) {
  return db.user.findUnique({ where: { id } });
}

export function findManyByIds(ids: string[]) {
  return db.user.findMany({ where: { id: { in: ids } } });
}

export function update(id: string, data: { name: string; preferredTimezone: string }) {
  return db.user.update({ where: { id }, data });
}

const userSummarySelect = {
  id: true,
  name: true,
  username: true,
  preferredTimezone: true,
} as const;

export async function list({ skip, take }: { skip: number; take: number }) {
  const [users, total] = await db.$transaction([
    db.user.findMany({
      skip,
      take,
      orderBy: { username: "asc" },
      select: userSummarySelect,
    }),
    db.user.count(),
  ]);
  return { users, total };
}
