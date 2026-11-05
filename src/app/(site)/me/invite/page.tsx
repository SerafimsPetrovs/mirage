import type { Metadata } from "next";
import { Coins, Gift, Repeat, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getReferralStats, REF_BONUS_INVITEE, REF_BONUS_INVITER, REF_MONTHLY_CAP } from "@/lib/referrals";
import { getI18n } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n/shared";
import { InviteLink } from "@/components/invite/invite-link";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.invite.title };
}

export default async function InvitePage() {
  const user = await requireUser("/me/invite");
  const { t, locale } = await getI18n();
  const stats = await getReferralStats(user.id);
  const steps = [
    { icon: Gift, text: t.invite.step1 },
    { icon: UserPlus, text: fmt(t.invite.step2, { n: REF_BONUS_INVITEE }) },
    { icon: Repeat, text: fmt(t.invite.step3, { n: REF_BONUS_INVITER }) },
  ];
  const tiles = [
    { label: t.invite.invited, value: stats.invited },
    { label: t.invite.activated, value: stats.activated },
    { label: t.invite.earned, value: stats.earned, coin: true },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <div
        className="grain overflow-hidden rounded-[28px] p-6 ring-1 ring-line md:p-8"
        style={{ background: "radial-gradient(90% 140% at 100% 0%, rgba(124,92,255,.32), transparent 55%), radial-gradient(70% 120% at 0% 100%, rgba(255,46,99,.24), transparent 60%), var(--surface)" }}
      >
        <h1 className="relative font-display text-3xl font-bold">{t.invite.title}</h1>
        <p className="relative mt-1 text-white/75">{t.invite.sub}</p>
        <div className="relative mt-6">
          <InviteLink code={stats.code} bonus={REF_BONUS_INVITEE} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
            <p className="text-xs text-muted md:text-sm">{x.label}</p>
            <p className={`mt-1 flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums ${x.coin ? "text-coin" : ""}`}>
              {x.coin && <Coins size={20} />} {formatNumber(x.value, locale)}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">{t.invite.howTitle}</h2>
      <ol className="space-y-3">
        {steps.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Icon size={20} />
            </span>
            <p className="self-center text-sm">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted">{fmt(t.invite.note, { cap: REF_MONTHLY_CAP })}</p>
    </div>
  );
}
