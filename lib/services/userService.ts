import { list } from "@/lib/repositories/userRepository";

export async function listUsers(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const { users, total } = await list({ skip, take: pageSize });
  return {
    data: users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
