import Link from "next/link";
import { Crown } from "lucide-react";
import { getCurrentUser, isVip } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { CoinAmount, Logo } from "@/components/ui/misc";
import { HeaderShell, NavLinks } from "./header-client";
import { UserMenu } from "./user-menu";
import { SearchButton } from "./command-palette";
import { KidsEnterButton, KidsExitButton } from "@/components/kids/kids-controls";

export async function SiteHeader() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const vip = isVip(user);
  const kids = !!user?.kidsMode;
  const links = [
    { href: "/", label: t.nav.home },
    { href: "/feed", label: t.nav.feed },
    { href: "/browse", label: t.nav.browse },
    ...(user && !kids ? [{ href: "/me#list", label: t.nav.myList }] : []),
  ];
  return (
    <HeaderShell>
      <div className="flex h-full items-center gap-3 px-4 md:gap-8 md:px-10">
        <Link href="/" aria-label="MIRAGE" className="flex shrink-0 items-center gap-2">
          <Logo className={kids ? "max-sm:text-[18px]" : undefined} />
          {kids && (
            <span className="rounded-full bg-[linear-gradient(100deg,#3ec5ff,#a78bfa,#ff7eb6)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white max-sm:hidden">
              {t.kids.badge}
            </span>
          )}
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
          <SearchButton label={t.nav.search} />
          {kids ? (
            <KidsExitButton />
          ) : user ? (
            <>
              <KidsEnterButton loggedIn hasPin={!!user.kidsPinHash} />
              {!vip && (
                <Link href="/vip" className={btn("glass", "sm", "max-lg:hidden")}>
                  <Crown size={15} className="text-vip" /> VIP
                </Link>
              )}
              <Link href="/me/wallet" className={btn("glass", "sm", "px-3")} aria-label={t.nav.wallet}>
                <CoinAmount value={user.coins} size={15} />
              </Link>
              <UserMenu
                user={{ name: user.name, email: user.email, hue: user.avatarHue, role: user.role, vip }}
              />
            </>
          ) : (
            <>
              <KidsEnterButton loggedIn={false} hasPin={false} />
              <Link href="/login" className={btn("ghost", "sm", "max-sm:hidden")}>
                {t.nav.login}
              </Link>
              <Link href="/register" className={btn("primary", "sm")}>
                {t.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
