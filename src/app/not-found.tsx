import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { Logo } from "@/components/ui/misc";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 40% at 50% 40%, rgba(124,92,255,.25), transparent 70%)" }} />
      <Link href="/" className="relative mb-12"><Logo /></Link>
      <p className="relative font-display text-[120px] font-bold leading-none text-mirage opacity-80 md:text-[180px]">404</p>
      <h1 className="relative mt-4 font-display text-2xl font-semibold">{t.common.notFound}</h1>
      <p className="relative mt-2 max-w-sm text-muted">{t.common.notFoundText}</p>
      <Link href="/" className={btn("primary", "lg", "relative mt-8")}>{t.common.toHome}</Link>
    </div>
  );
}
