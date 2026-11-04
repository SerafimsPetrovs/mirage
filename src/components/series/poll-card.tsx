"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Coins, Rocket, Vote } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/shared";
import { voteAction } from "@/app/actions/library";
import { boostPollAction } from "@/app/actions/extras";
import { POLL_VOTE_PRICE } from "@/lib/access";
import { useToast } from "@/components/ui/toast";
import { btn } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";

type Poll = {
  id: string;
  question: string;
  closesAt: string;
  closed: boolean;
  myOptionId: string | null;
  myBoost: number;
  options: { id: string; label: string; votes: number }[];
};

const PACKS = [1, 5, 10];

function timeLeft(iso: string, locale: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3600_000));
  const d = Math.floor(h / 24);
  if (locale === "en") return d > 0 ? `${d}d ${h % 24}h` : `${h}h`;
  return d > 0 ? `${d} д ${h % 24} ч` : `${h} ч`;
}

export function PollCard({ poll, loggedIn, canBoost, balance: balance0 }: { poll: Poll; loggedIn: boolean; canBoost: boolean; balance: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [boostOpt, setBoostOpt] = useState<string | null>(poll.myOptionId);
  const [pack, setPack] = useState(5);
  const [myBoost, setMyBoost] = useState(poll.myBoost);
  const [balance, setBalance] = useState(balance0);
  const [boosting, startBoost] = useTransition();
  const [mine, setMine] = useState(poll.myOptionId);
  const [options, setOptions] = useState(poll.options);
  const [pending, start] = useTransition();
  const total = options.reduce((a, o) => a + o.votes, 0);
  const showResults = !!mine || poll.closed;

  const vote = (id: string) => {
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    if (poll.closed || id === mine) return;
    const prev = mine;
    setOptions((os) => os.map((o) => ({ ...o, votes: o.votes + (o.id === id ? 1 : 0) - (o.id === prev ? 1 : 0) })));
    setMine(id);
    if (!boostOpt) setBoostOpt(id);
    start(async () => {
      const r = await voteAction(poll.id, id);
      if (!r.ok) {
        setMine(prev);
        setOptions(poll.options);
      }
    });
  };

  return (
    <div
      className="rounded-3xl p-5 ring-1 ring-line md:p-6"
      style={{ background: "radial-gradient(100% 140% at 100% 0%, rgba(124,92,255,.22), transparent 55%), var(--surface)" }}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-vip">
        <Vote size={18} /> {t.poll.title}
      </div>
      <h3 className="font-display text-lg font-semibold">{poll.question}</h3>
      <p className="mt-1 text-sm text-muted">{t.poll.sub}</p>
      <div className="mt-4 space-y-2" aria-busy={pending}>
        {options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const chosen = mine === o.id;
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={poll.closed}
              className={clsx(
                "relative flex w-full items-center justify-between overflow-hidden rounded-2xl px-4 py-3 text-left text-[15px] ring-1 transition",
                chosen ? "ring-vip/60" : "ring-line hover:ring-white/25",
              )}
            >
              {showResults && (
                <span
                  className={clsx("absolute inset-y-0 left-0 transition-all duration-500", chosen ? "bg-vip/25" : "bg-white/6")}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center gap-2 font-medium">
                {chosen && <Check size={16} className="text-vip" />}
                {o.label}
              </span>
              {showResults && <span className="relative text-sm font-semibold tabular-nums">{pct}%</span>}
            </button>
          );
        })}
      </div>
      {canBoost && !poll.closed && showResults && (
        <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-coin">
              <Rocket size={16} /> {t.boost.title}
            </p>
            <CoinAmount value={balance} size={13} className="text-xs" />
          </div>
          <p className="mt-1 text-xs text-muted">{fmt(t.boost.sub, { price: POLL_VOTE_PRICE })}</p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.boost.pick}>
            {options.map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={boostOpt === o.id}
                onClick={() => setBoostOpt(o.id)}
                className={clsx("max-w-full truncate rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition", boostOpt === o.id ? "bg-coin/15 text-coin ring-coin/50" : "ring-line hover:ring-white/25")}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-1.5">
            {PACKS.map((n) => (
              <button
                key={n}
                onClick={() => setPack(n)}
                aria-pressed={pack === n}
                className={clsx("h-9 flex-1 rounded-xl text-sm font-bold ring-1 transition", pack === n ? "bg-white text-black ring-white" : "ring-line hover:ring-white/25")}
              >
                +{n}
              </button>
            ))}
          </div>
          <button
            disabled={!boostOpt || boosting}
            onClick={() =>
              startBoost(async () => {
                const r = await boostPollAction(poll.id, boostOpt!, pack);
                if (r.ok) {
                  setBalance(r.balance);
                  setMyBoost((b) => b + pack);
                  setOptions((os) => os.map((o) => (o.id === boostOpt ? { ...o, votes: o.votes + pack } : o)));
                  toast(fmt(t.boost.done, { n: pack }), "coin");
                } else if (r.error === "insufficient") toast(t.spicy.notEnough, "error");
                else if (r.error === "owner") toast(t.boost.owner, "error");
                else toast(t.common.error, "error");
              })
            }
            className={btn("coin", "md", "mt-3 w-full")}
          >
            <Coins size={17} /> {fmt(t.boost.buy, { n: pack, price: pack * POLL_VOTE_PRICE })}
          </button>
          {myBoost > 0 && <p className="mt-2 text-center text-xs text-muted">{fmt(t.boost.mine, { n: myBoost })}</p>}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        {total} {plural(total, t.poll.votes, locale)} ·{" "}
        {poll.closed ? t.poll.closed : fmt(t.poll.closesIn, { t: timeLeft(poll.closesAt, locale) })}
        {!loggedIn && ` · ${t.poll.loginToVote}`}
      </p>
    </div>
  );
}
