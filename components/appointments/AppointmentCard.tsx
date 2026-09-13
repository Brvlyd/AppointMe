import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeParts } from "@/lib/time";

type Participant = {
  userId: string;
  user: { id: string; name: string; username: string; preferredTimezone: string };
};

export function AppointmentCard({
  appointment,
  viewerTimezone,
  viewerId,
}: {
  appointment: {
    id: string;
    title: string;
    description: string | null;
    start: Date;
    end: Date;
    creator: { id: string; name: string };
    participants: Participant[];
  };
  viewerTimezone: string;
  viewerId: string;
}) {
  const start = formatTimeParts(appointment.start, viewerTimezone);
  const end = formatTimeParts(appointment.end, viewerTimezone);
  const isCreator = appointment.creator.id === viewerId;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-base font-medium">{appointment.title}</h3>
          <Badge variant={isCreator ? "default" : "secondary"}>
            {isCreator ? "You created this" : `Invited by ${appointment.creator.name}`}
          </Badge>
        </div>

        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
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
          <div className="flex flex-wrap gap-1.5 pt-1">
            {appointment.participants.map((p) => (
              <span
                key={p.userId}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {p.user.name} · {p.user.preferredTimezone}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
