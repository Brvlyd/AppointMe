import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { Header } from "@/components/layout/Header";

export default async function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
