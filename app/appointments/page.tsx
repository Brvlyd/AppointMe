import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { listAppointmentsForUser } from "@/lib/services/appointmentService";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Button } from "@/components/ui/button";

export default async function AppointmentsPage() {
  // The layout above also checks this, but Next.js doesn't always re-run a
  // shared layout on client-side navigation between sibling pages under it
  // (see "Layouts and auth checks" in the Next.js auth guide) - without this
  // page-level check too, a session that goes stale mid-visit (e.g. the
  // referenced user no longer exists) crashes here instead of redirecting.
  // getCurrentUser() is cache()-deduped, so this isn't a second DB hit when
  // the layout's own check just ran in the same request.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const { data: appointments } = await listAppointmentsForUser(user.id, 1, 20);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Upcoming appointments</h1>
        <Button
          render={<Link href="/appointments/new" />}
          nativeButton={false}
          className="bg-amber-500 text-white hover:bg-amber-600"
        >
          New appointment
        </Button>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-primary/30 bg-primary/5 py-16 text-center">
          <Image src="/brand/mascot/Arrangy.png" alt="" width={100} height={100} />
          <div>
            <p className="font-medium">No appointments yet</p>
            <p className="text-sm text-muted-foreground">
              Create one and invite your teammates.
            </p>
          </div>
          <Button
            render={<Link href="/appointments/new" />}
            nativeButton={false}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            New appointment
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              viewerTimezone={user.preferredTimezone}
              viewerId={user.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
