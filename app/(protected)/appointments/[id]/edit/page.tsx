import Link from "next/link";
import { DateTime } from "luxon";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { getAppointmentById } from "@/lib/services/appointmentService";
import { listUsers } from "@/lib/services/userService";
import { CreateAppointmentForm } from "@/components/appointments/CreateAppointmentForm";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const appointment = await getAppointmentById(id, user.id);
  if (!appointment) {
    notFound();
  }
  if (appointment.creator.id !== user.id) {
    redirect(`/appointments/${id}`);
  }

  const { data: users } = await listUsers(1, 50);
  const invitableUsers = users.filter((u) => u.id !== user.id);

  // Stored UTC -> a "yyyy-MM-ddTHH:mm" string in the creator's own zone, the
  // same naive wall-clock format the datetime-local input produces/expects.
  const toLocalInput = (date: Date) =>
    DateTime.fromJSDate(date, { zone: "utc" })
      .setZone(user.preferredTimezone)
      .toFormat("yyyy-MM-dd'T'HH:mm");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/appointments/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>
      <h1 className="font-heading text-xl font-semibold">Edit appointment</h1>
      <CreateAppointmentForm
        currentUser={user}
        invitableUsers={invitableUsers}
        mode="edit"
        appointmentId={appointment.id}
        backHref={`/appointments/${id}`}
        initialValues={{
          title: appointment.title,
          description: appointment.description ?? "",
          start: toLocalInput(appointment.start),
          end: toLocalInput(appointment.end),
          participantIds: appointment.participants.map((p) => p.userId),
        }}
      />
    </div>
  );
}
