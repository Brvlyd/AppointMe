import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/services/authService";
import { createAppointment, listAppointmentsForUser } from "@/lib/services/appointmentService";
import { createAppointmentSchema, listAppointmentsQuerySchema } from "@/lib/validators/appointment";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listAppointmentsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await listAppointmentsForUser(user.id, parsed.data.page, parsed.data.pageSize);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
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

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await createAppointment({ creator: user, ...parsed.data });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, details: result.details }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
