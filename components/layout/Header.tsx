import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export function Header({ user }: { user: { name: string; preferredTimezone: string } }) {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-amber-500 bg-primary shadow-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <Link href="/appointments" className="shrink-0">
          <Image
            src="/brand/logo/appointme-white.png"
            alt="AppointMe!"
            width={194}
            height={44}
            className="h-8 w-auto sm:h-10"
            priority
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right leading-tight text-primary-foreground sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-primary-foreground/70">{user.preferredTimezone}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
