import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/services/authService";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    preferredTimezone: user.preferredTimezone,
  });
}
