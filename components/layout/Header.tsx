import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";

export function Header({ user }: { user: { name: string; preferredTimezone: string } }) {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-amber-500 bg-indigo-950 shadow-md">
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
          <Link
            href="/profile"
            className="hidden text-right leading-tight text-primary-foreground hover:underline sm:block"
          >
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-primary-foreground/70">{user.preferredTimezone}</p>
          </Link>
          <Button
            render={<Link href="/profile" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            Profile
          </Button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
