import { NextResponse } from "next/server";
import { login } from "@/lib/services/authService";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await login(parsed.data.username);

  if (!user) {
    return NextResponse.json({ error: "Invalid username" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    preferredTimezone: user.preferredTimezone,
  });
}
