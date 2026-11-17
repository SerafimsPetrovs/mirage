"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PartyStateDTO } from "@/lib/party";
import type { PartyOp } from "@/lib/party";
import { partyOpAction } from "@/app/actions/party";

export type PartyEvent = PartyStateDTO["events"][number];

const POLL_MS = 2000;

/**
 * Room state through polling (~2 s; also the member's heartbeat). Events accumulate across polls (deduped);
 * the server clock offset lets every member compute the same playback position.
 */
export function useParty(code: string, initial: PartyStateDTO) {
  const [state, setState] = useState(initial);
  const [events, setEvents] = useState<PartyEvent[]>(initial.events);
  const [gone, setGone] = useState<string | null>(null);
  const skew = useRef(0);
  const since = useRef(initial.events.at(-1)?.at ?? initial.serverNow - 1);
  const busy = useRef(false);

  const clock = useCallback(() => Date.now() + skew.current, []);
  // server clock offset, measured once mounted (Date.now is not allowed during render)
  useEffect(() => {
    skew.current = initial.serverNow - Date.now();
  }, [initial.serverNow]);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const sent = Date.now();
      const r = await fetch(`/api/party/${code}?since=${since.current}`, { cache: "no-store" });
      if (r.status === 410 || r.status === 403 || r.status === 401) {
        const j = await r.json().catch(() => ({}));
        setGone(j.error ?? "ENDED");
        return;
      }
      if (!r.ok) return;
      const d = (await r.json()) as PartyStateDTO;
      // half the round trip: a good-enough estimate of the server clock
      skew.current = d.serverNow - (sent + Date.now()) / 2;
      setState(d);
      if (d.events.length) {
        since.current = d.events[d.events.length - 1].at;
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          return [...prev, ...d.events.filter((e) => !seen.has(e.id))].slice(-300);
        });
      }
    } catch {
      /* offline for a moment: the next poll catches up */
    } finally {
      busy.current = false;
    }
  }, [code]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await load();
      t = setTimeout(loop, document.hidden ? POLL_MS * 3 : POLL_MS);
    };
    t = setTimeout(loop, POLL_MS);
    return () => clearTimeout(t);
  }, [load]);

  /** Sends an action and refreshes right away so the sender sees the result without waiting for the poll. */
  const send = useCallback(
    async (op: PartyOp) => {
      const r = await partyOpAction(code, op);
      void load();
      return r;
    },
    [code, load],
  );

  return { state, events, clock, send, gone, reload: load };
}
