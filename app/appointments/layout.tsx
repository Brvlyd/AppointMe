import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/authService";
import { Header } from "@/components/layout/Header";
import { FloatingMascot } from "@/components/FloatingMascot";

export default async function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div
      className="relative flex min-h-screen flex-col bg-background"
      style={{
        backgroundImage:
          "radial-gradient(circle at 100% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 55%), radial-gradient(circle at 0% 100%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 45%)",
      }}
    >
      <Header user={user} />
      <div className="h-1 w-full bg-linear-to-r from-primary via-indigo-400 to-amber-500" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <FloatingMascot />
    </div>
  );
}
