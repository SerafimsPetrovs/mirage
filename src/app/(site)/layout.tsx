import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tabbar";
import { getKidsMode } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [kids, { t }] = await Promise.all([getKidsMode(), getI18n()]);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-xl bg-white px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t.gdpr.skip}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="min-h-dvh outline-none">{children}</main>
      <SiteFooter />
      <MobileTabBar kids={kids} />
    </>
  );
}
