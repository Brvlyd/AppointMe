import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/services/authService";
import { listUsers } from "@/lib/services/userService";
import { listUsersQuerySchema } from "@/lib/validators/user";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listUsersQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await listUsers(parsed.data.page, parsed.data.pageSize);
  return NextResponse.json(result);
}
