import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.footer.creators };
}

export default async function CreatorsPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const isCreator = user && (user.role === "CREATOR" || user.role === "ADMIN");
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ background: "radial-gradient(50% 60% at 20% 0%, rgba(255,46,99,.35), transparent 70%), radial-gradient(40% 50% at 90% 10%, rgba(124,92,255,.3), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-[calc(var(--header-h)+48px)] md:px-10">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-2">
          <Clapperboard size={26} />
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">{t.creators.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/80">{t.creators.lead}</p>
        <ol className="mt-12 space-y-4">
          {t.creators.steps.map((s, i) => (
            <li key={s.t} className="flex gap-5 rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mirage font-display font-bold">{i + 1}</span>
              <div>
                <h2 className="font-display text-lg font-semibold">{s.t}</h2>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          {isCreator ? (
            <Link href="/studio" className={btn("primary", "lg")}>{t.creators.ctaStudio}</Link>
          ) : (
            <Link href={user ? "/me" : "/register?next=/me"} className={btn("primary", "lg")}>{t.creators.cta}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
