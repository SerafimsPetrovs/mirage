"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, MessageSquareText, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate } from "@/i18n/shared";
import { buyTickerAction, myTvOrdersAction, orderTvClipAction } from "@/app/actions/tv";
import { TV_IDEA_MAX, TV_ORDER_PRICE, TV_TICKER_MAX, TV_TICKER_PRICE, TV_TICKER_SHOW_MIN } from "@/lib/tv-rules";
import type { TvOrderDTO } from "@/lib/tv-types";

type Common = { open: boolean; onClose: () => void; slug: string; loggedIn: boolean; coins: number; onCoins: (n: number) => void; userName: string };

function LoginBox({ slug }: { slug: string }) {
  const { t } = useI18n();
  return (
    <Link href={`/login?next=${encodeURIComponent(`/tv/${slug}`)}`} className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-white font-semibold text-black">
      {t.tv.loginCta}
    </Link>
  );
}

function Balance({ coins }: { coins: number }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <Coins size={15} className="text-coin" /> {fmt(t.tv.coinsShort, { n: coins })}
    </span>
  );
}

const STATUS_TONE: Record<TvOrderDTO["status"], string> = {
  GENERATING: "bg-[#7dffb2]/15 text-[#7dffb2]",
  REVIEW: "bg-vip/15 text-vip",
  APPROVED: "bg-coin/15 text-coin",
  AIRED: "bg-ok/15 text-ok",
  REJECTED: "bg-white/10 text-white/60",
  FAILED: "bg-white/10 text-white/60",
};

export function OrderSheet({ open, onClose, slug, loggedIn, coins, onCoins, userName }: Common) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<TvOrderDTO[] | null>(null);

  useEffect(() => {
    if (!open || !loggedIn) return;
    let live = true;
    const load = () => myTvOrdersAction().then((r) => live && r.ok && setOrders(r.orders));
    void load();
    // Statuses move on their own (generation, moderation): refresh while the sheet is open.
    const id = window.setInterval(load, 8000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [open, loggedIn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await orderTvClipAction(slug, idea);
    setBusy(false);
    if (r.ok) {
      setIdea("");
      setOrders(r.orders);
      onCoins(r.balance);
      toast(t.tv.order.sent, "coin");
    } else if (r.error === "insufficient") toast(t.tv.noCoins, "error");
    else toast((t.tv.order.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
  };

  return (
    <Modal open={open} onClose={onClose} label={t.tv.order.title} className="max-w-lg">
      <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-coin/15 text-coin">
        <Sparkles size={22} />
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold">{t.tv.order.title}</h2>
      <p className="mt-2 text-[15px] text-muted">{fmt(t.tv.order.text, { name: userName || "…" })}</p>
      {!loggedIn ? (
        <LoginBox slug={slug} />
      ) : (
        <form onSubmit={submit} className="mt-5">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={TV_IDEA_MAX}
            rows={3}
            placeholder={t.tv.order.placeholder}
            aria-label={t.tv.order.title}
            className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] outline-none focus:border-coin/50"
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{fmt(t.tv.order.price, { price: TV_ORDER_PRICE })}</span>
            <span>
              {idea.length}/{TV_IDEA_MAX}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Balance coins={coins} />
            {coins < TV_ORDER_PRICE ? (
              <Link href="/me/wallet" className="inline-flex h-12 items-center rounded-2xl bg-coin px-5 font-semibold text-black">
                {t.tv.topUp}
              </Link>
            ) : (
              <button type="submit" disabled={busy || idea.trim().length < 5} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-coin px-5 font-semibold text-black disabled:opacity-50">
                <Coins size={17} /> {fmt(t.tv.order.submit, { price: TV_ORDER_PRICE })}
              </button>
            )}
          </div>
        </form>
      )}
      {loggedIn && !!orders?.length && (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">{t.tv.order.mine}</h3>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {orders.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="line-clamp-2">{o.idea}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {o.channel} · {formatDate(new Date(o.createdAt), locale)}
                  </p>
                </div>
                <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[o.status])}>{t.tv.order.status[o.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function TickerSheet({ open, onClose, slug, loggedIn, coins, onCoins, onSent }: Common & { onSent: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await buyTickerAction(slug, text);
    setBusy(false);
    if (r.ok) {
      setText("");
      onCoins(r.balance);
      onSent();
      toast(t.tv.ticker.sent, "coin");
      onClose();
    } else if (r.error === "insufficient") toast(t.tv.noCoins, "error");
    else toast((t.tv.ticker.errors as Record<string, string>)[r.error] ?? t.common.error, "error");
  };

  return (
    <Modal open={open} onClose={onClose} label={t.tv.ticker.title} className="max-w-md">
      <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde3b] text-black">
        <MessageSquareText size={22} />
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold">{t.tv.ticker.title}</h2>
      <p className="mt-2 text-[15px] text-muted">{fmt(t.tv.ticker.text, { min: TV_TICKER_SHOW_MIN })}</p>
      {!loggedIn ? (
        <LoginBox slug={slug} />
      ) : (
        <form onSubmit={submit} className="mt-5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={TV_TICKER_MAX}
            placeholder={t.tv.ticker.placeholder}
            aria-label={t.tv.ticker.title}
            className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[15px] outline-none focus:border-[#ffde3b]/60"
          />
          <div className="mt-1 text-right text-xs text-muted">
            {text.length}/{TV_TICKER_MAX}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Balance coins={coins} />
            {coins < TV_TICKER_PRICE ? (
              <Link href="/me/wallet" className="inline-flex h-12 items-center rounded-2xl bg-coin px-5 font-semibold text-black">
                {t.tv.topUp}
              </Link>
            ) : (
              <button type="submit" disabled={busy || !text.trim()} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#ffde3b] px-5 font-semibold text-black disabled:opacity-50">
                <Coins size={17} /> {fmt(t.tv.ticker.send, { price: TV_TICKER_PRICE })}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
