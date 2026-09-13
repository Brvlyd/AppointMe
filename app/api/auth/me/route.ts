import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/services/authService";
import { updateProfile } from "@/lib/services/userService";
import { updateProfileSchema } from "@/lib/validators/user";

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

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateProfile(user.id, parsed.data);

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    username: updated.username,
    preferredTimezone: updated.preferredTimezone,
  });
}
