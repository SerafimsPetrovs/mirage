import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUser, isVip } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { btn } from "@/components/ui/button";
import { CoinAmount, Logo } from "@/components/ui/misc";
import { HeaderShell, SectionSwitch } from "./header-client";
import { isAdultMode } from "@/lib/spicy";
import { UserMenu } from "./user-menu";
import { SearchButton } from "./command-palette";
import { KidsEnterButton, KidsExitButton } from "@/components/kids/kids-controls";
import { hotBountyCount } from "@/lib/tv-control";

/**
 * The header shows only what matters: logo + Live / Catalog / AI apps switch, a huge Family mode button,
 * coins (+), the loot roulette and the profile menu. Everything else lives in the menu, grouped by role.
 */
export async function SiteHeader() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const vip = isVip(user);
  const kids = !!user?.kidsMode;
  const creator = !!user && (user.role === "CREATOR" || user.role === "ADMIN");
  const hot = creator && !kids ? await hotBountyCount().catch(() => 0) : 0;
  return (
    <HeaderShell>
      <div className="flex h-full items-center gap-1.5 px-3 sm:gap-3 md:gap-5 md:px-8">
        <Link href={kids ? "/library" : "/"} aria-label="MIRAGE" className="flex shrink-0 items-center gap-2">
          <Logo className={kids ? "max-sm:text-[18px]" : "max-sm:text-[16px]"} />
          {kids && (
            <span className="rounded-full bg-[linear-gradient(100deg,#3ec5ff,#a78bfa,#ff7eb6)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white max-sm:hidden">
              {t.kids.badge}
            </span>
          )}
        </Link>
        {!kids && <SectionSwitch labels={{ live: t.v3.nav.live, catalog: t.v3.nav.catalog, apps: t.v3.nav.apps }} />}
        <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
          <SearchButton label={t.nav.search} />
          {kids ? (
            <KidsExitButton />
          ) : (
            <>
              <KidsEnterButton variant="soft" loggedIn={!!user} hasPin={!!user?.kidsPinHash} />
              {user ? (
                <>
                  <Link href="/me/wallet" className={btn("glass", "sm", "h-10 gap-1.5 pl-2.5 pr-1 sm:pl-3 sm:pr-1.5")} aria-label={t.v3.nav.addCoins} title={`${t.nav.wallet}: ${user.coins} · ${t.gold.name}: ${user.gold}`}>
                    <CoinAmount value={user.coins} size={15} />
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coin text-black sm:h-7 sm:w-7">
                      <Plus size={16} strokeWidth={2.6} />
                    </span>
                  </Link>
                  <UserMenu
                    user={{ name: user.name, email: user.email, hue: user.avatarHue, role: user.role, vip, adult: isAdultMode(user), coins: user.coins, gold: user.gold }}
                    hot={hot}
                  />
                </>
              ) : (
                <>
                  <Link href="/login" className={btn("ghost", "sm", "max-sm:px-2.5")}>
                    {t.nav.login}
                  </Link>
                  <Link href="/register" className={btn("primary", "sm", "max-sm:px-3")}>
                    {t.nav.register}
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
