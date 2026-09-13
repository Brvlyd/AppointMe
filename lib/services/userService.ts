import { list, update } from "@/lib/repositories/userRepository";

export async function listUsers(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const { users, total } = await list({ skip, take: pageSize });
  return {
    data: users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export function updateProfile(userId: string, data: { name: string; preferredTimezone: string }) {
  return update(userId, data);
}
