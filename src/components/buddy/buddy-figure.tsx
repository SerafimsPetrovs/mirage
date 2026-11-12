import { useId } from "react";
import clsx from "clsx";
import { buddyDef, type BuddyId, type BuddyMood, type Outfit, type OutfitSlot } from "@/lib/buddy-catalog";

/**
 * Watch buddies — simple, round, sticker-like characters (much simpler than the reporter host).
 * One shared face kit (eyes + mouth per mood) on six bodies; outfit pieces snap to per-body anchors.
 * viewBox 0 0 120 120, feet on the bottom edge.
 */
export function BuddyFigure({
  id,
  mood = "idle",
  outfit = {},
  talking = false,
  className,
}: {
  id: BuddyId;
  mood?: BuddyMood;
  outfit?: Outfit;
  /** Mouth open (the companion flaps it while a line is shown). */
  talking?: boolean;
  className?: string;
}) {
  const def = buddyDef(id);
  const Body = BODIES[id];
  return (
    <svg viewBox="0 0 120 120" className={clsx("overflow-visible", className)} aria-hidden>
      <ellipse cx="60" cy="116" rx="30" ry="4" fill="#000" opacity=".28" />
      <Body mood={mood} talking={talking} />
      {(["neck", "face", "hat"] as OutfitSlot[]).map((slot) => {
        const item = outfit[slot];
        if (!item || !PIECES[item]) return null;
        const a = def.anchors[slot];
        return (
          <g key={slot} transform={`translate(${a.x} ${a.y}) scale(${a.s})`}>
            {PIECES[item]}
          </g>
        );
      })}
    </svg>
  );
}

// ───────────── shared face kit ─────────────

const INK = "#1b1626";

function Eyes({ x1, x2, y, r, color = INK, mood }: { x1: number; x2: number; y: number; r: number; color?: string; mood: BuddyMood }) {
  const both = (f: (x: number) => React.ReactNode) => (
    <>
      {f(x1)}
      {f(x2)}
    </>
  );
  switch (mood) {
    case "laugh":
    case "happy":
      return both((x) => <path key={x} d={`M${x - r},${y + 1} Q${x},${y - r * 1.5} ${x + r},${y + 1}`} stroke={color} strokeWidth={r * 0.55} fill="none" strokeLinecap="round" />);
    case "sleep":
      return both((x) => <path key={x} d={`M${x - r},${y - 1} Q${x},${y + r * 1.2} ${x + r},${y - 1}`} stroke={color} strokeWidth={r * 0.5} fill="none" strokeLinecap="round" />);
    case "love":
      return both((x) => (
        <path key={x} d={`M${x},${y + r * 0.9} C${x - r * 1.6},${y - r * 0.2} ${x - r * 0.7},${y - r * 1.4} ${x},${y - r * 0.4} C${x + r * 0.7},${y - r * 1.4} ${x + r * 1.6},${y - r * 0.2} ${x},${y + r * 0.9}Z`} fill="#ff3b6b" />
      ));
    case "hype":
      return both((x) => (
        <path key={x} d={`M${x},${y - r * 1.2} L${x + r * 0.35},${y - r * 0.35} L${x + r * 1.2},${y} L${x + r * 0.35},${y + r * 0.35} L${x},${y + r * 1.2} L${x - r * 0.35},${y + r * 0.35} L${x - r * 1.2},${y} L${x - r * 0.35},${y - r * 0.35}Z`} fill="#ffcf3d" stroke={color} strokeWidth="1" />
      ));
    case "shock":
    case "scared":
      return both((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r * 1.25} fill="#fff" stroke={color} strokeWidth="1.2" />
          <circle cx={x} cy={y} r={r * (mood === "scared" ? 0.38 : 0.55)} fill={color} className={mood === "scared" ? "buddy-jitter" : undefined} />
        </g>
      ));
    case "bored":
      return both((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill={color} />
          <rect x={x - r - 1} y={y - r - 1} width={r * 2 + 2} height={r + 1} fill="currentColor" />
          <line x1={x - r - 1} x2={x + r + 1} y1={y} y2={y} stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ));
    case "sad":
      return (
        <>
          {[x1, x2].map((x) => (
            <circle key={x} cx={x} cy={y + 1} r={r * 0.85} fill={color} />
          ))}
          <path d={`M${x1 - r},${y - r * 1.1} L${x1 + r},${y - r * 1.8} M${x2 - r},${y - r * 1.8} L${x2 + r},${y - r * 1.1}`} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <g className="buddy-blink">
          {both((x) => (
            <g key={x}>
              <circle cx={x} cy={y} r={r} fill={color} />
              <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="#fff" />
            </g>
          ))}
        </g>
      );
  }
}

function Mouth({ x, y, w, mood, talking, color = INK, tongue = "#ff6b8a" }: { x: number; y: number; w: number; mood: BuddyMood; talking: boolean; color?: string; tongue?: string }) {
  const open = talking || mood === "laugh" || mood === "hype" || mood === "shock" || mood === "scared";
  if (mood === "sleep") return <ellipse cx={x} cy={y + 1} rx={w * 0.18} ry={w * 0.14} fill={color} opacity=".8" />;
  if (mood === "bored") return <line x1={x - w * 0.35} x2={x + w * 0.35} y1={y + 1} y2={y + 1} stroke={color} strokeWidth="1.8" strokeLinecap="round" />;
  if (mood === "sad" && !talking) return <path d={`M${x - w * 0.35},${y + 3} Q${x},${y - 3} ${x + w * 0.35},${y + 3}`} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  if (mood === "scared" && !talking)
    return <path d={`M${x - w * 0.4},${y + 2} l${w * 0.2},-3 l${w * 0.2},3 l${w * 0.2},-3 l${w * 0.2},3`} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  if (open) {
    const h = mood === "shock" ? w * 0.42 : mood === "laugh" || mood === "hype" ? w * 0.5 : w * 0.3;
    const rx = mood === "shock" ? w * 0.22 : w * 0.38;
    return (
      <g>
        <path d={`M${x - rx},${y - 1} Q${x},${y - 3} ${x + rx},${y - 1} Q${x + rx},${y + h} ${x},${y + h} Q${x - rx},${y + h} ${x - rx},${y - 1}Z`} fill={color} />
        <ellipse cx={x} cy={y + h * 0.72} rx={rx * 0.55} ry={h * 0.25} fill={tongue} />
      </g>
    );
  }
  return <path d={`M${x - w * 0.38},${y - 1} Q${x},${y + w * 0.32} ${x + w * 0.38},${y - 1}`} stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" />;
}

function Blush({ x1, x2, y, show = true }: { x1: number; x2: number; y: number; show?: boolean }) {
  if (!show) return null;
  return (
    <g fill="#ff7aa8" opacity=".45">
      <ellipse cx={x1} cy={y} rx="5" ry="3" />
      <ellipse cx={x2} cy={y} rx="5" ry="3" />
    </g>
  );
}

type BodyProps = { mood: BuddyMood; talking: boolean };

// ───────────── bodies ─────────────

/** Blip — a blob of TV static. Curious, cheerful, a bit naive. */
function Blip({ mood, talking }: BodyProps) {
  return (
    <g>
      <line x1="60" y1="44" x2="60" y2="28" stroke="#1f8f7d" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="25" r="5" fill="#ffe14d" className="buddy-glow" />
      <ellipse cx="44" cy="110" rx="9" ry="5" fill="#23b39b" />
      <ellipse cx="76" cy="110" rx="9" ry="5" fill="#23b39b" />
      <ellipse cx="19" cy="82" rx="7" ry="9" fill="#2cc9ae" transform="rotate(-20 19 82)" />
      <ellipse cx="101" cy="82" rx="7" ry="9" fill="#2cc9ae" transform="rotate(20 101 82)" />
      <path d="M60,40 C88,40 100,58 100,78 C100,98 84,108 60,108 C36,108 20,98 20,78 C20,58 32,40 60,40Z" fill="#3ee6c8" />
      <path d="M60,108 C84,108 100,98 100,78 C96,96 80,102 60,102 C40,102 24,96 20,78 C20,98 36,108 60,108Z" fill="#23b39b" />
      <ellipse cx="45" cy="54" rx="10" ry="5" fill="#fff" opacity=".35" transform="rotate(-20 45 54)" />
      <g fill="#fff" opacity=".35">
        <rect x="82" y="60" width="3" height="3" />
        <rect x="30" y="88" width="3" height="3" />
        <rect x="76" y="94" width="2" height="2" />
        <rect x="88" y="80" width="2" height="2" />
      </g>
      <g color="#3ee6c8">
        <Eyes x1={48} x2={72} y={72} r={6} mood={mood} />
      </g>
      <Blush x1={38} x2={82} y={84} show={mood !== "bored" && mood !== "sleep"} />
      <Mouth x={60} y={86} w={18} mood={mood} talking={talking} />
    </g>
  );
}

/** Kex — a lazy loaf of a cat. Sarcastic, sleeps a lot, secretly loves romance. */
function Kex({ mood, talking }: BodyProps) {
  return (
    <g>
      <path d="M92,104 C112,102 112,80 102,76" stroke="#e5781f" strokeWidth="8" fill="none" strokeLinecap="round" className="buddy-tail" style={{ transformOrigin: "92px 104px" }} />
      <ellipse cx="60" cy="98" rx="36" ry="18" fill="#ff9d42" />
      <ellipse cx="60" cy="104" rx="26" ry="10" fill="#ffd9ae" />
      <ellipse cx="46" cy="112" rx="8" ry="5" fill="#fff1df" />
      <ellipse cx="74" cy="112" rx="8" ry="5" fill="#fff1df" />
      <path d="M34,48 L38,20 L56,38Z" fill="#ff9d42" />
      <path d="M86,48 L82,20 L64,38Z" fill="#ff9d42" />
      <path d="M39,42 L41,27 L50,37Z" fill="#ffb3c4" />
      <path d="M81,42 L79,27 L70,37Z" fill="#ffb3c4" />
      <circle cx="60" cy="62" r="29" fill="#ff9d42" />
      <g stroke="#e5781f" strokeWidth="3" strokeLinecap="round">
        <line x1="60" y1="35" x2="60" y2="44" />
        <line x1="52" y1="36" x2="53" y2="43" />
        <line x1="68" y1="36" x2="67" y2="43" />
      </g>
      <ellipse cx="60" cy="74" rx="13" ry="9" fill="#fff1df" />
      <g color="#ff9d42">
        <Eyes x1={49} x2={71} y={60} r={5} mood={mood} />
      </g>
      <path d="M57,68 L63,68 L60,71Z" fill="#ff6b8a" />
      <g stroke="#7a4a20" strokeWidth="1" opacity=".6">
        <line x1="30" y1="70" x2="44" y2="72" />
        <line x1="30" y1="76" x2="44" y2="75" />
        <line x1="90" y1="70" x2="76" y2="72" />
        <line x1="90" y1="76" x2="76" y2="75" />
      </g>
      <Blush x1={40} x2={80} y={72} show={mood === "love" || mood === "happy"} />
      <Mouth x={60} y={75} w={12} mood={mood} talking={talking} />
    </g>
  );
}

/** Gosha — a little ghost. Scared of everything, loves horror anyway. */
function Gosha({ mood, talking }: BodyProps) {
  return (
    <g className="buddy-float">
      <path d="M28,104 L28,60 C28,40 42,28 60,28 C78,28 92,40 92,60 L92,104 Q84,112 76,104 Q68,96 60,104 Q52,112 44,104 Q36,96 28,104Z" fill="#eef2ff" />
      <path d="M92,60 L92,104 Q84,112 76,104 Q72,100 68,100 C82,94 86,78 86,60 C86,46 80,36 72,31 C84,35 92,46 92,60Z" fill="#c9d3f5" />
      <ellipse cx="24" cy="76" rx="7" ry="5" fill="#eef2ff" transform="rotate(-30 24 76)" />
      <ellipse cx="96" cy="76" rx="7" ry="5" fill="#dfe6ff" transform="rotate(30 96 76)" />
      <ellipse cx="46" cy="42" rx="8" ry="4" fill="#fff" opacity=".8" transform="rotate(-25 46 42)" />
      <g color="#eef2ff">
        <Eyes x1={49} x2={71} y={58} r={6.5} mood={mood} />
      </g>
      <Blush x1={40} x2={80} y={70} />
      <Mouth x={60} y={72} w={14} mood={mood} talking={talking} />
    </g>
  );
}

/** Popcorn — a bucket of hype. Loud, loves everything, eats during the show. */
function Popcorn({ mood, talking }: BodyProps) {
  const clip = useId();
  const puffs: [number, number, number][] = [
    [36, 48, 10], [50, 40, 11], [66, 38, 12], [82, 46, 10], [44, 30, 9], [60, 26, 10], [76, 30, 9], [92, 54, 7], [28, 54, 7],
  ];
  return (
    <g>
      {puffs.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill="#fff4d6" />
          <circle cx={x + r * 0.3} cy={y + r * 0.3} r={r * 0.55} fill="#ffe3a1" opacity=".8" />
        </g>
      ))}
      <path d="M26,54 L94,54 L84,114 L36,114Z" fill="#fff" />
      <clipPath id={clip}>
        <path d="M26,54 L94,54 L84,114 L36,114Z" />
      </clipPath>
      <g clipPath={`url(#${clip})`} fill="#ff4d5e">
        <rect x="22" y="50" width="12" height="70" transform="skewX(-6)" />
        <rect x="46" y="50" width="12" height="70" />
        <rect x="70" y="50" width="12" height="70" />
        <rect x="94" y="50" width="12" height="70" transform="skewX(6)" />
      </g>
      <rect x="24" y="52" width="72" height="7" rx="3" fill="#ff2e45" />
      <rect x="40" y="64" width="40" height="34" rx="12" fill="#fff" />
      <path d="M26,74 L14,84" stroke="#ff4d5e" strokeWidth="5" strokeLinecap="round" />
      <path d="M94,74 L106,84" stroke="#ff4d5e" strokeWidth="5" strokeLinecap="round" />
      <g color="#fff">
        <Eyes x1={51} x2={69} y={74} r={4.5} mood={mood} />
      </g>
      <Blush x1={44} x2={76} y={84} />
      <Mouth x={60} y={86} w={13} mood={mood} talking={talking} />
    </g>
  );
}

/** Bit — a deadpan critic robot. Rates everything out of 10, pretends not to have feelings. */
function Bit({ mood, talking }: BodyProps) {
  const g = "#6dffb0";
  return (
    <g>
      <line x1="60" y1="34" x2="60" y2="20" stroke="#5c6f8a" strokeWidth="3" />
      <circle cx="60" cy="18" r="4.5" fill="#ff4d5e" className="buddy-glow" />
      <rect x="42" y="88" width="36" height="22" rx="6" fill="#71839f" />
      <circle cx="60" cy="98" r="3.5" fill={g} opacity=".8" />
      <rect x="44" y="108" width="10" height="7" rx="2" fill="#4c5b72" />
      <rect x="66" y="108" width="10" height="7" rx="2" fill="#4c5b72" />
      <path d="M42,94 L30,102" stroke="#71839f" strokeWidth="5" strokeLinecap="round" />
      <path d="M78,94 L90,102" stroke="#71839f" strokeWidth="5" strokeLinecap="round" />
      <rect x="28" y="34" width="64" height="52" rx="12" fill="#8fa3c0" />
      <rect x="22" y="52" width="7" height="16" rx="3" fill="#71839f" />
      <rect x="91" y="52" width="7" height="16" rx="3" fill="#71839f" />
      <rect x="35" y="41" width="50" height="37" rx="7" fill="#0d1b24" />
      <rect x="38" y="43" width="20" height="4" rx="2" fill="#fff" opacity=".12" />
      <g color="#0d1b24">
        <Eyes x1={50} x2={70} y={56} r={4.5} mood={mood} color={g} />
      </g>
      <Mouth x={60} y={67} w={14} mood={mood} talking={talking} color={g} tongue="#0d1b24" />
    </g>
  );
}

/** Goose — chaos with a beak. Honks, wanders around the screen, has opinions. */
function Goose({ mood, talking }: BodyProps) {
  const open = talking || mood === "laugh" || mood === "shock" || mood === "hype" || mood === "scared";
  return (
    <g>
      <path d="M46,110 l-6,6 h12z M74,110 l-6,6 h12z" fill="#ff9a1f" />
      <rect x="44" y="104" width="3" height="8" fill="#ff9a1f" />
      <rect x="73" y="104" width="3" height="8" fill="#ff9a1f" />
      <path d="M22,92 C22,78 40,74 60,76 C84,78 100,84 100,96 C100,106 84,110 60,110 C38,110 22,104 22,92Z" fill="#f7f7f7" />
      <path d="M40,88 C52,82 74,84 86,94 C74,102 52,102 40,88Z" fill="#d9dde6" />
      <path d="M20,90 L10,84 L16,96Z" fill="#e8eaf0" />
      <path d="M64,82 C66,70 60,58 58,48" stroke="#f7f7f7" strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx="58" cy="38" r="15" fill="#f7f7f7" />
      {open ? (
        <g>
          <path d="M68,35 L88,32 L70,39Z" fill="#ff9a1f" />
          <path d="M68,41 L86,47 L69,44Z" fill="#e57e10" />
        </g>
      ) : (
        <path d="M68,34 L88,39 L68,44Z" fill="#ff9a1f" />
      )}
      <g color="#f7f7f7">
        <Eyes x1={52} x2={63} y={35} r={2.6} mood={mood} />
      </g>
      {mood === "love" && <Blush x1={50} x2={66} y={44} />}
    </g>
  );
}

const BODIES: Record<BuddyId, (p: BodyProps) => React.ReactNode> = { blip: Blip, kex: Kex, gosha: Gosha, popcorn: Popcorn, bit: Bit, goose: Goose };

// ───────────── outfit pieces (drawn around the anchor 0,0) ─────────────

const PIECES: Record<string, React.ReactNode> = {
  cap: (
    <g>
      <path d="M-22,2 C-22,-20 22,-20 22,2Z" fill="#e5394b" />
      <path d="M-8,-17 C0,-19 8,-17 8,-17" stroke="#fff" strokeWidth="2" opacity=".5" fill="none" />
      <path d="M4,0 L34,3 Q34,8 4,6Z" fill="#b8202f" />
      <circle cx="0" cy="-17" r="2.5" fill="#b8202f" />
    </g>
  ),
  beanie: (
    <g>
      <path d="M-22,2 C-22,-24 22,-24 22,2Z" fill="#4f7cff" />
      <path d="M-14,-12 h28 M-19,-4 h38" stroke="#7ea0ff" strokeWidth="3" />
      <rect x="-24" y="-3" width="48" height="9" rx="4.5" fill="#3a5fd9" />
      <circle cx="0" cy="-22" r="6" fill="#fff" />
    </g>
  ),
  party: (
    <g transform="rotate(12)">
      <path d="M-13,3 L13,3 L0,-30Z" fill="#ffcf3d" />
      <path d="M-9,-7 L6,-3 M-5,-17 L4,-14" stroke="#ff4d8b" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="0" cy="-31" r="4.5" fill="#ff4d8b" />
      <ellipse cx="0" cy="3" rx="14" ry="3" fill="#e6b52a" />
    </g>
  ),
  headphones: (
    <g>
      <path d="M-27,14 C-27,-20 27,-20 27,14" stroke="#24242c" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="-34" y="6" width="11" height="20" rx="5" fill="#ff2e63" />
      <rect x="23" y="6" width="11" height="20" rx="5" fill="#ff2e63" />
      <rect x="-31" y="10" width="3" height="12" rx="1.5" fill="#fff" opacity=".4" />
    </g>
  ),
  tophat: (
    <g>
      <rect x="-14" y="-28" width="28" height="30" rx="2" fill="#1c1c24" />
      <rect x="-14" y="-9" width="28" height="6" fill="#ff2e63" />
      <ellipse cx="0" cy="2" rx="24" ry="5" fill="#111118" />
      <rect x="-10" y="-25" width="4" height="14" rx="2" fill="#fff" opacity=".1" />
    </g>
  ),
  crown: (
    <g>
      <path d="M-20,3 L20,3 L22,-16 L11,-6 L0,-21 L-11,-6 L-22,-16Z" fill="#ffcd3c" stroke="#c9961a" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="-20" y="-1" width="40" height="5" fill="#f2b81f" />
      <circle cx="0" cy="-8" r="3" fill="#ff2e63" />
      <circle cx="-12" cy="-3" r="2" fill="#3ee6c8" />
      <circle cx="12" cy="-3" r="2" fill="#7c5cff" />
    </g>
  ),
  shades: (
    <g>
      <rect x="-21" y="-6" width="18" height="12" rx="5" fill="#111" />
      <rect x="3" y="-6" width="18" height="12" rx="5" fill="#111" />
      <path d="M-3,-2 h6" stroke="#111" strokeWidth="2.5" />
      <path d="M-18,-3 l6,0" stroke="#fff" strokeWidth="1.6" opacity=".5" strokeLinecap="round" />
      <path d="M6,-3 l6,0" stroke="#fff" strokeWidth="1.6" opacity=".5" strokeLinecap="round" />
    </g>
  ),
  glasses3d: (
    <g>
      <rect x="-22" y="-7" width="44" height="14" rx="3" fill="#fafafa" />
      <rect x="-19" y="-4.5" width="15" height="9" rx="2" fill="#ff3b4e" opacity=".85" />
      <rect x="4" y="-4.5" width="15" height="9" rx="2" fill="#2ad4ff" opacity=".85" />
    </g>
  ),
  hearts: (
    <g fill="#ff4d8b" stroke="#c21f5b" strokeWidth="1.2">
      <path d="M-11,7 C-23,0 -19,-10 -11,-5 C-3,-10 1,0 -11,7Z" />
      <path d="M11,7 C-1,0 3,-10 11,-5 C19,-10 23,0 11,7Z" />
      <path d="M-3,-2 h6" stroke="#c21f5b" strokeWidth="2" />
    </g>
  ),
  scarf: (
    <g>
      <path d="M-26,-5 Q0,6 26,-5 L26,4 Q0,15 -26,4Z" fill="#ff4d5e" />
      <path d="M-14,0 v8 M0,3 v8 M14,0 v8" stroke="#fff" strokeWidth="3" opacity=".75" />
      <path d="M10,6 L20,6 L22,26 L12,26Z" fill="#ff4d5e" />
      <path d="M12,26 v4 M16,26 v4 M20,26 v4" stroke="#ff4d5e" strokeWidth="1.5" />
    </g>
  ),
  bowtie: (
    <g>
      <path d="M0,0 L-15,-8 L-15,8Z" fill="#ff2e63" />
      <path d="M0,0 L15,-8 L15,8Z" fill="#ff2e63" />
      <rect x="-4" y="-4.5" width="8" height="9" rx="2.5" fill="#c4134a" />
    </g>
  ),
  halo: (
    <g className="buddy-float">
      <ellipse cx="0" cy="-14" rx="20" ry="6" fill="none" stroke="#ffe27a" strokeWidth="4.5" />
      <ellipse cx="0" cy="-14" rx="20" ry="6" fill="none" stroke="#fff6c9" strokeWidth="1.5" opacity=".9" />
    </g>
  ),
  laurel: (
    <g fill="#5fbf6a" stroke="#3d8f47" strokeWidth=".8">
      {[-1, 1].map((d) => (
        <g key={d} transform={`scale(${d} 1)`}>
          <path d="M3,2 C12,2 22,-4 25,-14" fill="none" stroke="#3d8f47" strokeWidth="1.8" />
          <ellipse cx="9" cy="-1" rx="5" ry="2.6" transform="rotate(-15 9 -1)" />
          <ellipse cx="16" cy="-4" rx="5" ry="2.6" transform="rotate(-35 16 -4)" />
          <ellipse cx="21" cy="-9" rx="5" ry="2.6" transform="rotate(-55 21 -9)" />
          <ellipse cx="24" cy="-15" rx="4.5" ry="2.4" transform="rotate(-75 24 -15)" />
        </g>
      ))}
      <circle cx="0" cy="2" r="2.6" fill="#ffcd3c" stroke="#c9961a" />
    </g>
  ),
  starshades: (
    <g fill="#ffcf3d" stroke="#b8860b" strokeWidth="1.2" strokeLinejoin="round">
      {[-11, 11].map((x) => (
        <path key={x} d={`M${x},-9 L${x + 2.6},-3 L${x + 9},-2.6 L${x + 4},1.6 L${x + 5.6},8 L${x},4.4 L${x - 5.6},8 L${x - 4},1.6 L${x - 9},-2.6 L${x - 2.6},-3Z`} />
      ))}
      <path d="M-3,-1 h6" stroke="#b8860b" strokeWidth="2" />
    </g>
  ),
  medal: (
    <g>
      <path d="M-10,-6 L-3,12 L3,12 L10,-6 L4,-6 L0,4 L-4,-6Z" fill="#ff2e63" />
      <circle cx="0" cy="17" r="8" fill="#ffcd3c" stroke="#c9961a" strokeWidth="1.5" />
      <path d="M0,12 L1.6,15.4 L5.2,15.8 L2.5,18.2 L3.2,21.8 L0,20 L-3.2,21.8 L-2.5,18.2 L-5.2,15.8 L-1.6,15.4Z" fill="#fff4c4" />
    </g>
  ),
  chain: (
    <g>
      <path d="M-22,-6 Q0,16 22,-6" stroke="#ffcd3c" strokeWidth="3.5" fill="none" strokeDasharray="4 2" />
      <circle cx="0" cy="12" r="7" fill="#ffcd3c" stroke="#c9961a" strokeWidth="1.5" />
      <text x="0" y="15.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#8a6410">M</text>
    </g>
  ),
  // ───── film & meme references ─────
  /** An adventurer's fedora (whip not included). */
  fedora: (
    <g>
      <ellipse cx="0" cy="1" rx="31" ry="6.5" fill="#6e4726" />
      <path d="M-17,0 C-19,-21 -7,-23 0,-16 C7,-23 19,-21 17,0Z" fill="#8d6038" />
      <rect x="-17.5" y="-7" width="35" height="5.5" fill="#33200f" />
      <path d="M-4,-17 Q0,-13 4,-17" stroke="#6e4726" strokeWidth="1.6" fill="none" />
    </g>
  ),
  /** A grey wizard's pointy hat with a bent tip. */
  wizard: (
    <g>
      <ellipse cx="0" cy="2" rx="29" ry="5.5" fill="#666b77" />
      <path d="M-16,1 L16,1 L5,-26 Q3,-37 14,-42 Q-1,-40 -4,-27Z" fill="#8a909c" />
      <path d="M-14,-3 L14,-3" stroke="#5a5f6a" strokeWidth="3" />
    </g>
  ),
  /** A red action-hero headband, tails flying. */
  headband: (
    <g transform="translate(0 7)">
      <rect x="-24" y="-3" width="48" height="7" rx="3" fill="#e0243a" />
      <path d="M22,0 Q31,3 36,13 M22,2 Q29,8 29,18" stroke="#e0243a" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  ),
  /** A Friday-night slasher hockey mask. */
  hockeymask: (
    <g>
      <ellipse cx="0" cy="2" rx="20" ry="17" fill="#f2efe6" stroke="#bdb8aa" strokeWidth="1.2" />
      <ellipse cx="-8" cy="-3" rx="5" ry="3.5" fill="#1b1626" />
      <ellipse cx="8" cy="-3" rx="5" ry="3.5" fill="#1b1626" />
      <path d="M-3,-13 L0,-9 L3,-13 M-15,5 L-11,9 M15,5 L11,9" stroke="#d12a2a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="-5" cy="11" r="1.3" fill="#1b1626" />
      <circle cx="0" cy="12.5" r="1.3" fill="#1b1626" />
      <circle cx="5" cy="11" r="1.3" fill="#1b1626" />
    </g>
  ),
  /** Tiny oval shades: red pill or blue pill? */
  matrix: (
    <g>
      <ellipse cx="-9" cy="0" rx="8" ry="5" fill="#0b0b0b" />
      <ellipse cx="9" cy="0" rx="8" ry="5" fill="#0b0b0b" />
      <path d="M-1,-0.5 h2" stroke="#0b0b0b" strokeWidth="2" />
      <path d="M-13,-1.5 l4,-1 M5,-1.5 l4,-1" stroke="#3dff7a" strokeWidth="1.3" opacity=".75" strokeLinecap="round" />
    </g>
  ),
  /** The yellow tracksuit with a black stripe — dressed for revenge. */
  yellowsuit: (
    <g>
      <path d="M-26,-4 Q0,6 26,-4 L24,24 Q0,30 -24,24Z" fill="#f7d417" />
      <path d="M-15,0 L-11,27 M15,0 L11,27" stroke="#111" strokeWidth="4" />
      <path d="M-8,-1 L0,8 L8,-1" stroke="#c9a80d" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
    </g>
  ),
  /** A superhero cape (flying not included). */
  cape: (
    <g>
      <path d="M-25,-3 Q-35,20 -31,37 L-20,31 Q-22,12 -17,3Z" fill="#b30f2a" />
      <path d="M25,-3 Q35,20 31,37 L20,31 Q22,12 17,3Z" fill="#b30f2a" />
      <path d="M-26,-6 Q0,6 26,-6 L22,2 Q0,12 -22,2Z" fill="#e2263f" />
      <circle cx="0" cy="4" r="4" fill="#ffcd3c" stroke="#c9961a" />
    </g>
  ),
  /** Nobody knows what a flugegeheimen is. But now you own one. */
  flugegeheimen: (
    <g>
      <path d="M-20,-6 Q0,12 20,-6" stroke="#9aa3b5" strokeWidth="2" fill="none" />
      <g transform="translate(0 15)">
        <path d="M-11,-2 l-5,-4 M11,-2 l5,-4 M0,8 v5" stroke="#7c5cff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-8,-7 L8,-7 L5,8 L-5,8Z" fill="#7c5cff" />
        <circle cx="0" cy="0" r="3.4" fill="#3ee6c8" className="buddy-glow" />
        <path d="M-4,-4 Q0,-8 4,-4" stroke="#fff" strokeWidth="1" fill="none" opacity=".6" />
      </g>
    </g>
  ),
  /** The "67" pendant. Six. Seven. */
  sixseven: (
    <g>
      <path d="M-22,-6 Q0,14 22,-6" stroke="#c0c6d4" strokeWidth="3" fill="none" strokeDasharray="3 2" />
      <rect x="-12" y="6" width="24" height="14" rx="4" fill="#ff2e63" stroke="#c4134a" />
      <text x="0" y="17" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">
        67
      </text>
    </g>
  ),
};
