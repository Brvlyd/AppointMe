import { NextResponse } from "next/server";
import { logout } from "@/lib/services/authService";

export async function POST() {
  await logout();
  return NextResponse.json({ success: true });
}
