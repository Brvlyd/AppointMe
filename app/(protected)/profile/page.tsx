import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Profile settings</h1>
      <ProfileForm
        currentUser={{ name: user.name, username: user.username, preferredTimezone: user.preferredTimezone }}
        timezones={timezones}
      />
    </div>
  );
}
