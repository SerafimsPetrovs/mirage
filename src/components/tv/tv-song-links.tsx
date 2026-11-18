"use client";
import { useEffect, useState } from "react";
import type { TvSlotDTO } from "@/lib/tv-types";
import { SeriesChip, SongChip } from "@/components/songs/song-chip";

/**
 * Songs ↔ series on TV. An episode on air: "♪ <song> → My music" while a tagged song plays.
 * A music video sent from the songs section: the song itself (♥ → My music) and the series it plays in.
 */
export function TvSongLinks({ slot, timeRef, loggedIn, className }: { slot: TvSlotDTO; timeRef: React.RefObject<number>; loggedIn: boolean; className?: string }) {
  const [now, setNow] = useState(0);
  const tagged = slot.songs.length > 0;
  useEffect(() => {
    if (!tagged) return;
    const id = window.setInterval(() => setNow(timeRef.current ?? 0), 500);
    return () => clearInterval(id);
  }, [tagged, timeRef]);

  if (slot.song) {
    return (
      <div className={className}>
        <div className="flex flex-col items-start gap-1.5">
          <SongChip key={slot.song.id} song={{ id: slot.song.id, title: slot.song.title, artist: slot.song.artist }} loggedIn={loggedIn} />
          {slot.song.usedIn.slice(0, 2).map((u) => (
            <SeriesChip key={u.episodeId} use={u} className="bg-black/60" />
          ))}
        </div>
      </div>
    );
  }
  const playing = slot.songs.find((x) => now >= x.atSec && now < x.atSec + x.lenSec);
  if (!playing) return null;
  return (
    <div className={className}>
      <SongChip key={playing.id} song={playing} loggedIn={loggedIn} />
    </div>
  );
}
