// Shapes sent from the TV API to the client (shared by server and client code).

export type TvVideo = {
  /** Plain mp4 URL (null when only HLS is available). */
  src: string | null;
  /** Personal watermarked HLS playlist (catalog episodes with protection). */
  hls: string | null;
  orientation: "VERTICAL" | "HORIZONTAL";
};

/** "Info" popover: what is on screen, who made it and with which AI tools. */
export type TvInfoDTO = {
  title: string;
  lore: string;
  author: { id: string; name: string } | null;
  aiTools: string[];
  tags: string[];
  ageRating: string;
};

export type TvMascotDTO = {
  timeline: import("./mascot").TimelineItem[];
  audioUrl: string | null;
};

export type TvSlotDTO = {
  id: string;
  kind: "CLIP" | "EPISODE" | "HOST" | "BREAK" | "CHART" | "QUIZ" | "NEWS";
  startsAt: number;
  durationSec: number;
  title: string;
  /** Second line: artist, series + episode number, "Ad break"… */
  subtitle: string;
  /** HOST/CHART: what the host says. */
  text: string;
  video: TvVideo | null;
  /** Sponsored clip in an ad break. */
  sponsor: string | null;
  /** Top-10 place of a music video in the countdown. */
  chartPlace: number | null;
  /** Catalog episode: where to continue watching. */
  series: { slug: string; title: string; poster: string } | null;
  clipId: string | null;
  clipKind: string | null;
  /** QUIZ: the options (the question is in `text`; the answer stays on the server until the slot ends). */
  quiz: { options: string[] } | null;
  likes: number;
  liked: boolean;
  info: TvInfoDTO | null;
  /** WebVTT/SRT text shown as subtitles while muted. */
  captions: string | null;
  /** NEWS (breaking news by the mascot): the emotional timeline and optional TTS file. */
  mascot: TvMascotDTO | null;
};

export type TvChannelDTO = {
  slug: string;
  number: number;
  name: string;
  tagline: string;
  kind: string;
  hue: number;
  hostName: string;
  ticker: boolean;
  isAdult: boolean;
  familyOnly: boolean;
};

export type TvNowDTO = {
  serverNow: number;
  channel: TvChannelDTO;
  slot: TvSlotDTO;
  next: TvSlotDTO[];
};

export type TvChatMessage = { id: string; at: number; name: string; hue: number; text: string; mine: boolean; paid: number };
export type TvTickerItem = { id: string; name: string; text: string };
export type TvChatDTO = { messages: TvChatMessage[]; tickers: TvTickerItem[]; serverNow: number };

export type TvOrderDTO = {
  id: string;
  channel: string;
  idea: string;
  status: "GENERATING" | "REVIEW" | "APPROVED" | "AIRED" | "REJECTED" | "FAILED";
  coins: number;
  createdAt: number;
  airedAt: number | null;
  rejectReason: string | null;
};

export type TvPollDTO = {
  id: string;
  endsAt: number;
  options: { title: string; votes: number }[];
  myVote: number | null;
  /** Set once the poll ended: the programme that airs next. */
  winner: number | null;
};

export type TvPinnedDTO = { id: string; name: string; text: string; paid: number; until: number };

/** Everything that changes every few seconds on a channel (polled). */
export type TvLiveDTO = {
  serverNow: number;
  viewers: number;
  messages: TvChatMessage[];
  tickers: TvTickerItem[];
  reactions: { id: string; emoji: string }[];
  pinned: TvPinnedDTO | null;
  poll: TvPollDTO | null;
  /** Gold granted by this heartbeat (watching rewards). */
  goldEarned: number;
  gold: number | null;
  /** System alerts / crawl from the control room. */
  alerts: { id: string; text: string }[];
  /** Live teleprompter: the mascot in a corner window over the current video. */
  pip: (TvMascotDTO & { id: string; startsAt: number; text: string }) | null;
};

/** Title of what a channel shows now (channel cards, the guide). */
export function stripTitle(p: Pick<TvSlotDTO, "kind" | "title" | "subtitle">) {
  return p.kind === "EPISODE" ? `${p.title} · ${p.subtitle}` : [p.subtitle, p.title].filter(Boolean).join(" — ");
}
