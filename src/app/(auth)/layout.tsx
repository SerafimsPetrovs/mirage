import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, rgba(124,92,255,.35), transparent 70%), radial-gradient(50% 50% at 90% 90%, rgba(255,46,99,.3), transparent 70%), radial-gradient(40% 40% at 80% 15%, rgba(255,181,71,.18), transparent 70%)",
        }}
      />
      <header className="relative px-5 py-5 md:px-10">
        <Link href="/" aria-label="MIRAGE">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">{children}</main>
    </div>
  );
}
