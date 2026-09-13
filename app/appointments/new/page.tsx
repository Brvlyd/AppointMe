import { getCurrentUser } from "@/lib/services/authService";
import { listUsers } from "@/lib/services/userService";
import { CreateAppointmentForm } from "@/components/appointments/CreateAppointmentForm";

export default async function NewAppointmentPage() {
  // Layout above already redirects if unauthenticated.
  const user = (await getCurrentUser())!;
  // Only 4 seed users exist - one large page is simpler than building
  // pagination UI for an invite picker that will rarely have many entries.
  const { data: users } = await listUsers(1, 50);
  const invitableUsers = users.filter((u) => u.id !== user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">New appointment</h1>
      <CreateAppointmentForm currentUser={user} invitableUsers={invitableUsers} />
    </div>
  );
}
