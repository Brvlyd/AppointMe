import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export function Header({ user }: { user: { name: string; preferredTimezone: string } }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/appointments" className="flex items-center gap-2">
          <Image src="/brand/logo/appointme.png" alt="" width={28} height={28} />
          <span className="hidden font-heading text-sm font-medium sm:inline">AppointMe!</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.preferredTimezone}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
