import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { getAppointmentById } from "@/lib/services/appointmentService";
import { formatTimeParts } from "@/lib/time";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteAppointmentButton } from "@/components/appointments/DeleteAppointmentButton";

export default async function AppointmentDetailPage({
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

  const start = formatTimeParts(appointment.start, user.preferredTimezone);
  const end = formatTimeParts(appointment.end, user.preferredTimezone);
  const isCreator = appointment.creator.id === user.id;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/appointments"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>

      <Card className="border-l-4 border-l-primary">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-heading text-xl font-semibold">{appointment.title}</h1>
            <Badge variant={isCreator ? "default" : "secondary"}>
              {isCreator ? "You created this" : `Invited by ${appointment.creator.name}`}
            </Badge>
          </div>

          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {start.time}
              <span className="mx-1.5 text-muted-foreground">–</span>
              {end.time}
            </p>
            <p className="text-sm font-medium text-primary">{start.zoneLabel}</p>
          </div>

          {appointment.description && (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {appointment.description}
            </p>
          )}

          {appointment.participants.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Participants</p>
              <div className="flex flex-wrap gap-1.5">
                {appointment.participants.map((p) => (
                  <span
                    key={p.userId}
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {p.user.name} · {p.user.preferredTimezone}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isCreator && (
            <div className="flex items-center gap-3 border-t border-border pt-4">
              <Button
                render={<Link href={`/appointments/${appointment.id}/edit`} />}
                nativeButton={false}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                Edit
              </Button>
              <DeleteAppointmentButton appointmentId={appointment.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
