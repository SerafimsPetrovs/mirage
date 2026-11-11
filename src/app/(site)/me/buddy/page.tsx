import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAchievements, getBuddyState } from "@/lib/buddy";
import { getI18n } from "@/i18n/server";
import { BuddyShop } from "@/components/buddy/buddy-shop";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.buddy.menu };
}

export default async function BuddyPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const [state, achievements] = user ? await Promise.all([getBuddyState(user.id), getAchievements(user.id)]) : [null, null];
  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-[calc(var(--header-h)+24px)] md:px-10">
      <h1 className="font-display text-3xl font-bold">{t.buddy.pageTitle}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{t.buddy.pageSub}</p>
      <BuddyShop
        initial={state ? { look: state.look, owned: state.owned, gold: state.gold, coins: state.coins } : null}
        kids={!!user?.kidsMode}
        achievements={achievements}
      />
    </div>
  );
}
