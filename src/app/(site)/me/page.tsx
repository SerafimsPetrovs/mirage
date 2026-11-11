import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Clapperboard, Crown, Gift, History, MessageCircleHeart, Shield, Smile, Wallet } from "lucide-react";
import { isAdultMode } from "@/lib/spicy";
import { prisma } from "@/lib/db";
import { isVip, requireUser } from "@/lib/auth";
import { VerifyEmailBanner } from "@/components/auth/verify-banner";
import { getCheckInState } from "@/lib/coins";
import { getContinueWatching, seriesCardSelect, toCard } from "@/lib/catalog";
import { getI18n } from "@/i18n/server";
import { fmt, formatDate } from "@/i18n/shared";
import { btn } from "@/components/ui/button";
import { Avatar, CoinAmount, EmptyState, VipBadge } from "@/components/ui/misc";
import { ContinueCard } from "@/components/media/cards";
import { SeriesGrid } from "@/components/media/grid";
import { Row, RowItem } from "@/components/media/row";
import { CheckInWidget } from "@/components/wallet/checkin-widget";
import { CreatorApplyForm, ProfileForm } from "@/components/profile/profile-forms";
import { LangSwitch } from "@/components/layout/lang-switch";
import { FamilyPinCard } from "@/components/kids/kids-controls";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.me.title };
}

export default async function MePage() {
  const user = await requireUser("/me");
  const { t, locale } = await getI18n();
  const [history, list, checkIn, application] = await Promise.all([
    getContinueWatching(user.id, locale, 20),
    prisma.listItem.findMany({
      where: { userId: user.id, series: { status: "PUBLISHED" } },
      orderBy: { createdAt: "desc" },
      select: { series: { select: seriesCardSelect } },
    }),
    getCheckInState(user.id),
    prisma.creatorApplication.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const vip = isVip(user);

  return (
    <div className="pb-10 pt-[calc(var(--header-h)+24px)]">
      <div className="px-4 md:px-10">
        {!user.emailVerifiedAt && !user.kidsMode && <VerifyEmailBanner email={user.email} className="mb-4" />}
        <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-5 ring-1 ring-line md:flex-row md:items-center md:p-7">
          <Avatar name={user.name} hue={user.avatarHue} size={76} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">
              {user.name} {vip && <VipBadge />}
            </h1>
            <p className="mt-1 text-sm text-muted">{fmt(t.me.memberSince, { date: formatDate(user.createdAt, locale) })}</p>
            {vip && user.subscription && (
              <p className="mt-1 text-sm text-vip">{fmt(t.vip.activeUntil, { date: formatDate(user.subscription.currentPeriodEnd, locale) })}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/me/wallet" className={btn("glass", "md")}>
              <Wallet size={18} /> <CoinAmount value={user.coins} />
            </Link>
            <Link href="/me/buddy" className={btn("glass", "md")}>
              <Smile size={18} className="text-[#3ee6c8]" /> {t.buddy.menu}
            </Link>
            <Link href="/me/invite" className={btn("glass", "md")}>
              <Gift size={18} className="text-accent" /> {t.invite.nav}
            </Link>
            {isAdultMode(user) && (
              <Link href="/me/chats" className={btn("glass", "md")}>
                <MessageCircleHeart size={18} /> {t.me.myChats}
              </Link>
            )}
            {!vip && (
              <Link href="/vip" className={btn("vip", "md")}>
                <Crown size={18} /> VIP
              </Link>
            )}
            {(user.role === "CREATOR" || user.role === "ADMIN") && (
              <Link href="/studio" className={btn("glass", "md")}>
                <Clapperboard size={18} /> {t.nav.studio}
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link href="/admin" className={btn("glass", "md")}>
                <Shield size={18} /> {t.nav.admin}
              </Link>
            )}
          </div>
        </div>

        {/* claimed today → it lives in the wallet; the profile stays short */}
        {!checkIn.doneToday && (
          <div className="mt-5">
            <CheckInWidget state={checkIn} compact />
          </div>
        )}
      </div>

      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 px-4 font-display text-xl font-semibold md:px-10">
          <History size={20} className="text-muted" /> {t.me.history}
        </h2>
        {history.length ? (
          <Row>
            {history.map((h) => (
              <RowItem key={h.id}>
                <ContinueCard item={h} t={t} />
              </RowItem>
            ))}
          </Row>
        ) : (
          <div className="px-4 md:px-10">
            <EmptyState mascot="want-you" icon={<History size={24} />} title={t.me.emptyHistory} action={<Link href="/feed" className={btn("primary", "md")}>{t.home.feedPromoCta}</Link>} />
          </div>
        )}
      </section>

      {!user.kidsMode && (
        <section id="family" className="mt-10 scroll-mt-24 px-4 md:px-10">
          <FamilyPinCard hasPin={!!user.kidsPinHash} />
        </section>
      )}

      <section id="list" className="mt-10 scroll-mt-24 px-4 md:px-10">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
          <Bookmark size={20} className="text-muted" /> {t.me.myList}
        </h2>
        {list.length ? (
          <SeriesGrid items={list.map((l) => toCard(l.series, locale))} t={t} locale={locale} />
        ) : (
          <EmptyState mascot="shrug" icon={<Bookmark size={24} />} title={t.me.emptyList} action={<Link href="/browse" className={btn("glass", "md")}>{t.nav.browse}</Link>} />
        )}
      </section>

      <section className="mt-12 grid gap-5 px-4 md:grid-cols-2 md:px-10">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
          <h2 className="mb-5 font-display text-lg font-semibold">{t.me.settings}</h2>
          <ProfileForm name={user.name} bio={user.bio ?? ""} hue={user.avatarHue} />
          <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
            <span className="text-sm text-muted">{t.nav.language}</span>
            <LangSwitch />
          </div>
        </div>
        {user.role === "VIEWER" && (
          <CreatorApplyForm status={application?.status === "PENDING" ? "PENDING" : application?.status === "REJECTED" ? "REJECTED" : null} />
        )}
      </section>
    </div>
  );
}
