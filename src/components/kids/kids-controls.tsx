"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { KeyRound, Lock, Users } from "lucide-react";
import { btn, inputCls } from "@/components/ui/button";
import { Modal, PinInput } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { enterKidsModeAction, exitKidsModeAction, resetKidsPinAction } from "@/app/actions/kids";

type EnterProps = {
  loggedIn: boolean;
  hasPin: boolean;
  /** header = compact pill (short label on phones); hero = large CTA */
  variant?: "header" | "hero";
  autoOpen?: boolean;
  className?: string;
};

/** The big bright "Kids mode" button: one click in; the first time it asks the parent for a PIN. */
export function KidsEnterButton({ loggedIn, hasPin, variant = "header", autoOpen, className }: EnterProps) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  // Came back from login with ?family=on and no PIN yet → open the PIN dialog right away
  const [open, setOpen] = useState(!!autoOpen && loggedIn && !hasPin);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const turnOn = (newPin?: string) =>
    start(async () => {
      const r = await enterKidsModeAction(newPin);
      if (r.ok) {
        setOpen(false);
        toast(t.kids.welcome);
        router.push("/");
        router.refresh();
      } else if (r.error === "needPin") setOpen(true);
      else if (r.error === "auth") router.push(`/login?next=${encodeURIComponent("/?family=on")}`);
      else toast(t.common.error, "error");
    });

  const click = () => {
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent("/?family=on")}`);
    if (hasPin) turnOn();
    else setOpen(true);
  };

  // Came back from login with ?family=on and the PIN already exists → switch on immediately
  useEffect(() => {
    if (autoOpen && loggedIn && hasPin) turnOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, loggedIn, hasPin]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    if (pin !== pin2) return setErr(t.kids.pinMismatch);
    turnOn(pin);
  };

  return (
    <>
      <button
        onClick={click}
        disabled={pending}
        className={clsx(
          variant === "hero" ? btn("kids", "lg") : btn("kids", "sm", "h-10 px-3.5 text-[15px] md:px-4"),
          "kids-glow relative",
          className,
        )}
      >
        <Users size={variant === "hero" ? 20 : 17} className="shrink-0" />
        {variant === "hero" ? (
          t.kids.promoCta
        ) : (
          <>
            <span className="sm:hidden">{t.kids.enterShort}</span>
            <span className="max-sm:hidden">{t.kids.enter}</span>
          </>
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={t.kids.setPinTitle}>
        <form onSubmit={submit} className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3ec5ff,#7b6cff,#ff7eb6)] text-white">
            <Users size={26} />
          </div>
          <h2 className="font-display text-lg font-semibold">{t.kids.setPinTitle}</h2>
          <p className="mt-1.5 text-sm text-muted">{t.kids.setPinText}</p>
          <div className="mt-5 space-y-4">
            <PinInput value={pin} onChange={(v) => { setPin(v); setErr(null); }} label={t.kids.setPinTitle} autoFocus />
            <div>
              <p className="mb-2 text-xs font-medium text-muted">{t.kids.repeatPin}</p>
              <PinInput value={pin2} onChange={(v) => { setPin2(v); setErr(null); }} label={t.kids.repeatPin} error={!!err} />
            </div>
          </div>
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
          <button disabled={pending || pin.length !== 4 || pin2.length !== 4} className={btn("kids", "lg", "mt-6 w-full")}>
            {t.kids.turnOn}
          </button>
        </form>
      </Modal>
    </>
  );
}

/** Always-visible "Exit kids mode" button. Needs the parent PIN (or the account password to reset it). */
export function KidsExitButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pin" | "reset">("pin");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setMode("pin");
    setPin("");
    setPassword("");
    setErr(null);
  };

  const done = () => {
    close();
    router.push("/");
    router.refresh();
  };

  const submitPin = (value: string) =>
    start(async () => {
      const r = await exitKidsModeAction(value);
      if (r.ok) return done();
      setPin("");
      setErr(r.error === "locked" ? t.kids.lockedPin : t.kids.wrongPin);
    });

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await resetKidsPinAction(password, pin);
      if (r.ok) return done();
      setErr(r.error === "wrong" ? t.kids.wrongPassword : t.common.error);
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx(btn("secondary", "sm", "h-10 px-3.5 text-[15px] md:px-4"), className)}>
        <Lock size={16} className="shrink-0" />
        <span className="sm:hidden">{t.kids.exitShort}</span>
        <span className="max-sm:hidden">{t.kids.exit}</span>
      </button>
      <Modal open={open} onClose={close} label={t.kids.exitTitle}>
        {mode === "pin" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Lock size={24} />
            </div>
            <h2 className="font-display text-lg font-semibold">{t.kids.exitTitle}</h2>
            <p className="mt-1.5 text-sm text-muted">{t.kids.exitText}</p>
            <div className="mt-5" aria-busy={pending}>
              <PinInput
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  setErr(null);
                  if (v.length === 4) submitPin(v);
                }}
                label={t.kids.exitText}
                error={!!err}
                autoFocus
              />
            </div>
            <p className={clsx("mt-3 min-h-5 text-sm", err ? "text-red-300" : "text-transparent")} role="alert">
              {err ?? "·"}
            </p>
            <button onClick={() => { setMode("reset"); setErr(null); setPin(""); }} className="mt-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline">
              {t.kids.forgot}
            </button>
          </div>
        ) : (
          <form onSubmit={submitReset} className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <KeyRound size={24} />
            </div>
            <h2 className="font-display text-lg font-semibold">{t.kids.resetTitle}</h2>
            <p className="mt-1.5 text-sm text-muted">{t.kids.resetText}</p>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(null); }}
              placeholder={t.kids.password}
              aria-label={t.kids.password}
              autoComplete="current-password"
              className={clsx(inputCls, "mt-5")}
              autoFocus
            />
            <p className="mb-2 mt-4 text-xs font-medium text-muted">{t.kids.newPin}</p>
            <PinInput value={pin} onChange={setPin} label={t.kids.newPin} />
            {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
            <button disabled={pending || !password || pin.length !== 4} className={btn("primary", "lg", "mt-6 w-full")}>
              {t.kids.reset}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
