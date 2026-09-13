import { db } from "@/lib/db";

export function findByUsername(username: string) {
  return db.user.findUnique({ where: { username } });
}

export function findById(id: string) {
  return db.user.findUnique({ where: { id } });
}
