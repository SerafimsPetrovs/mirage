import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tabbar";
import { getKidsMode } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const kids = await getKidsMode();
  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">{children}</main>
      <SiteFooter />
      <MobileTabBar kids={kids} />
    </>
  );
}
