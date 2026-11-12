import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { Logo } from "@/components/ui/misc";
import { LangSwitch } from "./lang-switch";
import { Mode67Switch } from "./mode67-switch";
import { getKidsMode } from "@/lib/auth";

export async function SiteFooter() {
  const [{ t }, kids] = await Promise.all([getI18n(), getKidsMode()]);
  return (
    <footer className="mt-20 border-t border-line px-4 pb-[calc(var(--tabbar-h)+32px)] pt-10 md:px-10 md:pb-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-xs text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
          <Link href="/about" className="hover:text-text">{t.footer.about}</Link>
          <Link href="/creators" className="hover:text-text">{t.footer.creators}</Link>
          <Link href="/vip" className="hover:text-text">VIP</Link>
          <Link href="/legal/terms" className="hover:text-text">{t.footer.terms}</Link>
          <Link href="/legal/privacy" className="hover:text-text">{t.legal.privacy}</Link>
          <Link href="/legal/copyright" className="hover:text-text">{t.legal.copyright}</Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Mode67Switch kids={kids} />
          <LangSwitch />
        </div>
      </div>
      <p className="mt-10 text-xs text-muted/70">© {new Date().getFullYear()} MIRAGE · {t.footer.rights}</p>
    </footer>
  );
}
