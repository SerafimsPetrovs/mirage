"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, Coins, Lock, SendHorizontal, ShieldAlert } from "lucide-react";
import { btn } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";
import { confirmAdultAction, sendChatAction, unlockPhotoAction } from "@/app/actions/extras";
import { CHAT_FREE_MESSAGES, CHAT_MAX_LEN, CHAT_MESSAGE_PRICE } from "@/lib/spicy";
import type { ChatMsg } from "@/lib/extras";
import { CharacterAvatar, useSpicyRunner } from "@/components/player/spicy";

type Props = {
  character: { id: string; name: string; tagline: string; greeting: string; avatar: string | null; hue: number };
  series: { slug: string; title: string };
  initial: ChatMsg[];
  sent: number;
  balance: number;
  needsAge: boolean;
};

export function CharacterChat({ character, series, initial, sent: sent0, balance: balance0, needsAge }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [sent, setSent] = useState(sent0);
  const [balance, setBalance] = useState(balance0);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [ageGate, setAgeGate] = useState(needsAge);
  const [photoV, setPhotoV] = useState<Record<string, number>>({});
  const [, startAge] = useTransition();
  const runner = useSpicyRunner(setBalance);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  const freeLeft = Math.max(0, CHAT_FREE_MESSAGES - sent);

  const send = () => {
    const body = text.trim();
    if (!body || typing) return;
    const tmpId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tmpId, role: "user", body, createdAt: new Date().toISOString(), photo: null }]);
    setText("");
    setTyping(true);
    runner.run(
      () => sendChatAction(character.id, body),
      (r) => {
        setTyping(false);
        setSent((n) => n + 1);
        setMessages((m) => [
          ...m,
          {
            id: r.reply.id,
            role: "character",
            body: r.reply.body,
            createdAt: new Date().toISOString(),
            photo: r.reply.photo ? { ...r.reply.photo, unlocked: false } : null,
          },
        ]);
      },
      () => {
        setTyping(false);
        setMessages((m) => m.filter((x) => x.id !== tmpId));
        setText(body);
      },
    );
  };

  const unlock = (photoId: string) =>
    runner.run(
      () => unlockPhotoAction(photoId),
      () => {
        setMessages((m) => m.map((x) => (x.photo?.id === photoId ? { ...x, photo: { ...x.photo, unlocked: true } } : x)));
        setPhotoV((v) => ({ ...v, [photoId]: Date.now() }));
        toast(t.spicy.unlocked, "coin");
      },
    );

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `radial-gradient(70% 50% at 50% 0%, hsl(${character.hue} 70% 30% / .45), transparent 70%)` }}
      />
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-line bg-bg/70 px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl md:px-6">
        <Link href={`/series/${series.slug}`} aria-label={t.chat.back} className={btn("ghost", "icon")}>
          <ChevronLeft size={22} />
        </Link>
        <CharacterAvatar c={character} size={42} online />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{character.name}</p>
          <p className={clsx("truncate text-xs", typing ? "text-accent-2" : "text-ok")}>{typing ? t.chat.typing : `${t.chat.onlineNow} · ${series.title}`}</p>
        </div>
        <Link href="/me/wallet" className={btn("glass", "sm", "px-3")} aria-label={t.nav.wallet}>
          <CoinAmount value={balance} size={14} />
        </Link>
      </header>

      {/* Messages */}
      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5 px-3 py-5 md:px-6">
          <div className="mb-3 flex flex-col items-center text-center">
            <CharacterAvatar c={character} size={84} />
            <p className="mt-3 font-display text-lg font-semibold">{character.name}</p>
            {character.tagline && <p className="mt-0.5 max-w-xs text-sm text-muted">{character.tagline}</p>}
            <p className="mt-2 rounded-full bg-white/6 px-3 py-1 text-[11px] text-muted">{t.chat.disclaimer}</p>
          </div>
          {character.greeting && <Bubble mine={false}>{character.greeting}</Bubble>}
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}>
              <Bubble mine={m.role === "user"}>{m.body}</Bubble>
              {m.photo && (
                <div className="relative w-56 overflow-hidden rounded-3xl ring-1 ring-white/10 md:w-64">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photo/${m.photo.id}${photoV[m.photo.id] ? `?v=${photoV[m.photo.id]}` : ""}`}
                    alt={m.photo.caption || t.chat.photo}
                    className="aspect-[3/4] w-full bg-surface-2 object-cover"
                    loading="lazy"
                  />
                  {!m.photo.unlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 p-4 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/30 backdrop-blur">
                        <Lock size={20} />
                      </span>
                      <span className="text-sm font-semibold drop-shadow">{t.chat.photo}</span>
                      <button onClick={() => unlock(m.photo!.id)} disabled={runner.pending} className={btn("coin", "sm")}>
                        <Coins size={15} /> {fmt(t.chat.unlockPhoto, { price: m.photo.price })}
                      </button>
                    </div>
                  )}
                  {m.photo.unlocked && m.photo.caption && <p className="bg-surface-2 px-3 py-2 text-xs text-muted">{m.photo.caption}</p>}
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="flex items-start">
              <span className="flex gap-1 rounded-3xl rounded-bl-lg bg-surface-2 px-4 py-3.5 ring-1 ring-line" aria-label={t.chat.typing}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            </div>
          )}
          <div ref={end} />
        </div>
      </div>

      {/* Composer */}
      <div className="relative z-10 border-t border-line bg-bg/80 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl md:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 px-1 text-xs text-muted">
            {freeLeft > 0 ? fmt(t.chat.freeLeft, { n: freeLeft }) : (
              <span className="inline-flex items-center gap-1 text-coin">
                <Coins size={12} /> {fmt(t.chat.pricePer, { price: CHAT_MESSAGE_PRICE })}
              </span>
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={t.chat.placeholder}
              aria-label={t.chat.placeholder}
              className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl bg-surface-2 px-4 py-3 text-[15px] outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-accent/60"
            />
            <button disabled={!text.trim() || typing} aria-label={t.chat.send} className={btn("primary", "icon", "h-12 w-12 shrink-0")}>
              <SendHorizontal size={20} />
            </button>
          </form>
        </div>
      </div>

      {ageGate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg/85 p-4 backdrop-blur-xl">
          <div className="animate-pop w-full max-w-sm rounded-[28px] bg-surface p-6 text-center ring-1 ring-line">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 font-display text-lg font-bold text-accent-2">18+</div>
            <h2 className="font-display text-lg font-semibold">{t.spicy.ageTitle}</h2>
            <p className="mt-2 text-sm text-muted">{t.spicy.ageText}</p>
            <button
              className={btn("primary", "lg", "mt-6 w-full")}
              onClick={() =>
                startAge(async () => {
                  const r = await confirmAdultAction();
                  if (r.ok) {
                    setAgeGate(false);
                    input.current?.focus();
                  }
                })
              }
            >
              <ShieldAlert size={18} /> {t.spicy.ageConfirm}
            </button>
            <button className={btn("ghost", "lg", "mt-2 w-full")} onClick={() => router.push(`/series/${series.slug}`)}>
              {t.spicy.ageDecline}
            </button>
          </div>
        </div>
      )}
      {runner.gate}
    </div>
  );
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "animate-fade-up max-w-[82%] whitespace-pre-line break-words rounded-3xl px-4 py-2.5 text-[15px] leading-snug",
        mine ? "self-end rounded-br-lg bg-accent text-white" : "self-start rounded-bl-lg bg-surface-2 ring-1 ring-line",
      )}
    >
      {children}
    </div>
  );
}
