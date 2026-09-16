import { useState } from "react";
import type { NpcPortrait } from "@/game/types";
import { PORTRAIT_IMAGES } from "@/assets/portraits";

export const KNOWN_PORTRAIT_IDS = [
  "orithel-the-last-watcher",
  "scribe-althea",
  "sister-mirene",
  "barris-the-smith",
  "kiln-master-vance",
  "cinder-nurse-greta",
  "elodie-outrunner",
  "mistress-morveth",
  "sister-lyra",
  "kieran-blind-oar",
  "reeve-toran",
  "hermit-cassian",
  "mina-drift-child",
] as const;

export type KnownPortraitId = typeof KNOWN_PORTRAIT_IDS[number];

interface NpcPortraitViewProps {
  portrait: NpcPortrait;
  speaker: string;
  color?: string;
}

export default function NpcPortraitView({
  portrait,
  speaker,
  color = "#ffb259",
}: NpcPortraitViewProps) {
  const { id, description } = portrait;
  const [imageError, setImageError] = useState(false);
  const imageSrc = PORTRAIT_IMAGES[id];

  return (
    <div
      data-portrait-id={id}
      title={description}
      aria-label={`Portrait of ${speaker}: ${description}`}
      className="relative flex h-32 w-24 shrink-0 flex-col overflow-hidden rounded-lg border border-amber-200/30 bg-[#0c0a12] shadow-lg sm:w-32"
    >
      <div className="absolute inset-0">
        {imageSrc && !imageError ? (
          <img
            src={imageSrc}
            alt={description}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover object-top transition-opacity duration-300"
            loading="eager"
          />
        ) : (
          <PortraitSvg id={id} />
        )}
      </div>

      {/* Frame border highlight & subtle ID label at bottom */}
      <div className="pointer-events-none absolute inset-0 rounded-lg border border-white/5" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/40 to-transparent p-1 text-center">
        <span
          className="block truncate font-title text-[8px] uppercase tracking-widest opacity-80"
          style={{ color }}
        >
          {id.replace(/^orithel-.*/, "watcher").replace(/-/g, " ")}
        </span>
      </div>
    </div>
  );
}

function PortraitSvg({ id }: { id: string }) {
  switch (id) {
    case "orithel-the-last-watcher":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="orithel-bg" cx="50%" cy="100%" r="90%">
              <stop offset="0%" stopColor="#1a4d52" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#081e22" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#040d10" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="orithel-aura" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#76f2df" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#3ca89a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#103632" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="orithel-collar" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f5e6ba" />
              <stop offset="50%" stopColor="#d1a742" />
              <stop offset="100%" stopColor="#87661b" />
            </linearGradient>
          </defs>
          <rect width="128" height="128" fill="url(#orithel-bg)" />

          {/* Fractured Spire Halo */}
          <g transform="translate(68, 48) rotate(-15)">
            <polygon points="0,-36 6,-24 -6,-24" fill="#9ff7e6" opacity="0.6" />
            <polygon points="26,-24 34,-14 20,-16" fill="#9ff7e6" opacity="0.45" />
            <polygon points="-26,-24 -34,-14 -20,-16" fill="#9ff7e6" opacity="0.45" />
            <polygon points="36,4 44,14 30,12" fill="#76f2df" opacity="0.35" />
            <polygon points="-36,4 -44,14 -30,12" fill="#76f2df" opacity="0.35" />
            <circle cx="0" cy="0" r="30" fill="none" stroke="#76f2df" strokeWidth="1" strokeDasharray="3,5" opacity="0.4" />
          </g>

          {/* Aura light from below */}
          <circle cx="68" cy="120" r="60" fill="url(#orithel-aura)" />

          {/* Drifting long white hair back layer */}
          <path d="M44,48 Q32,70 38,105 Q50,78 48,56 Z" fill="#d2f2ed" opacity="0.8" />
          <path d="M88,48 Q100,72 96,110 Q84,82 86,56 Z" fill="#c0eae4" opacity="0.75" />

          {/* Body/Robes */}
          <path d="M36,128 L46,88 Q68,96 90,88 L100,128 Z" fill="#0d282d" />
          <path d="M48,88 L68,128 L88,88 Z" fill="#143c44" />

          {/* Severe Gold & Ivory High Collar */}
          <path d="M46,84 L68,98 L90,84 L80,68 L56,68 Z" fill="url(#orithel-collar)" stroke="#132c2c" strokeWidth="1.5" />
          <polygon points="68,74 74,86 68,96 62,86" fill="#fdfae8" />

          {/* Neck & Head */}
          <path d="M60,60 L68,76 L76,60 Z" fill="#9ce5de" />
          <path d="M52,38 Q68,26 82,38 Q88,58 76,70 Q68,76 60,70 Q48,58 52,38 Z" fill="#baf5ee" />

          {/* Elder Elven Facial Features (ethereal, stoic) */}
          <path d="M60,48 Q64,46 68,48" stroke="#1d5c58" strokeWidth="1.5" fill="none" />
          <path d="M72,48 Q76,46 80,48" stroke="#1d5c58" strokeWidth="1.5" fill="none" />
          <polygon points="68,50 66,58 70,58" fill="#58a49c" opacity="0.6" />
          <line x1="64" y1="64" x2="72" y2="64" stroke="#256e69" strokeWidth="1.5" />

          {/* Foreground Drifting White Hair Strands */}
          <path d="M50,34 Q66,22 84,34 Q74,48 72,62 Q66,32 50,34 Z" fill="#ecfaf8" />
          <path d="M46,38 Q40,54 44,72" stroke="#d5f6f1" strokeWidth="2" fill="none" />
          <path d="M84,38 Q90,56 86,74" stroke="#d5f6f1" strokeWidth="2" fill="none" />
        </svg>
      );

    case "scribe-althea":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="althea-bg" cx="40%" cy="40%" r="90%">
              <stop offset="0%" stopColor="#3d2714" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#1a0f07" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0a0502" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#althea-bg)" />

          {/* Candle Amber Glow */}
          <circle cx="34" cy="50" r="32" fill="#ffb454" opacity="0.12" />

          {/* Robes & Shoulders */}
          <path d="M30,128 L40,84 L88,84 L98,128 Z" fill="#2d2319" />
          <path d="M46,84 L64,128 L82,84 Z" fill="#423425" />

          {/* Ochre Hood Back */}
          <path d="M36,54 Q64,16 92,54 Q98,82 88,96 Q64,104 40,96 Q30,80 36,54 Z" fill="#966d2a" />
          <path d="M42,56 Q64,26 86,56 Q90,78 82,90 Q64,96 46,90 Z" fill="#75521b" />

          {/* Face */}
          <path d="M52,50 Q64,42 76,50 Q82,66 74,76 Q64,82 54,76 Q48,66 52,50 Z" fill="#e8cfb5" />

          {/* Silver Hair Peeking Out */}
          <path d="M50,48 Q64,36 78,48 Q70,44 58,44 Z" fill="#d2d6dc" />

          {/* Quill Pin in Hood */}
          <path d="M76,30 L88,14 L85,26 L94,18 L82,36 Z" fill="#f5eedc" stroke="#4a371c" strokeWidth="1" />
          <line x1="86" y1="18" x2="78" y2="34" stroke="#876634" strokeWidth="1.5" />

          {/* Facial Features (concentrated archivist) */}
          <ellipse cx="58" cy="58" rx="2" ry="1.5" fill="#442a17" />
          <ellipse cx="70" cy="58" rx="2" ry="1.5" fill="#442a17" />
          <path d="M64,61 L63,68 L66,68" stroke="#946540" strokeWidth="1.2" fill="none" />
          <line x1="60" y1="73" x2="68" y2="73" stroke="#844d32" strokeWidth="1.5" />

          {/* Ochre Hood Drapes Front */}
          <path d="M40,56 Q34,74 46,92 L52,86 Z" fill="#b58434" />
          <path d="M88,56 Q94,74 82,92 L76,86 Z" fill="#9e722a" />

          {/* Clutched Cracked Ledger & Ink-stained fingers */}
          <g transform="translate(42, 94) rotate(-8)">
            <rect x="0" y="0" width="46" height="34" rx="2" fill="#523218" stroke="#c49a56" strokeWidth="1.5" />
            <line x1="12" y1="0" x2="12" y2="34" stroke="#331e0c" strokeWidth="2" />
            <path d="M22,8 L28,18 L24,24 L32,30" stroke="#1c1108" strokeWidth="1.5" fill="none" />
            {/* Hands with ink smudges */}
            <rect x="30" y="-4" width="12" height="10" rx="3" fill="#dfbe9f" />
            <circle cx="34" cy="-1" r="2" fill="#141824" />
            <circle cx="39" cy="2" r="1.5" fill="#141824" />
          </g>
        </svg>
      );

    case "sister-mirene":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="mirene-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#1a3d32" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#0a1d17" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#030c09" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="mirene-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8ffcca" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#41a87b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#mirene-bg)" />

          {/* Soft Jade Ambience */}
          <circle cx="64" cy="98" r="44" fill="url(#mirene-glow)" opacity="0.4" />

          {/* Sea-green Veil / Robes */}
          <path d="M28,128 L38,76 Q64,84 90,76 L100,128 Z" fill="#1b3d33" />
          <path d="M34,44 Q64,18 94,44 Q102,78 96,118 Q64,124 32,118 Q26,78 34,44 Z" fill="#396c5c" />
          <path d="M42,48 Q64,28 86,48 Q92,76 86,104 Q64,110 42,104 Z" fill="#2d584a" />

          {/* Pale solemn face */}
          <path d="M52,50 Q64,44 76,50 Q80,68 74,78 Q64,84 54,78 Q48,68 52,50 Z" fill="#d9ebe3" />

          {/* Veil border trim */}
          <path d="M40,46 Q64,24 88,46" stroke="#8fcca8" strokeWidth="2" fill="none" opacity="0.8" />

          {/* Serene downcast eyes & soft expression */}
          <path d="M56,58 Q60,62 64,58" stroke="#235243" strokeWidth="1.5" fill="none" />
          <path d="M68,58 Q72,62 76,58" stroke="#235243" strokeWidth="1.5" fill="none" />
          <path d="M66,62 L65,68 L68,68" stroke="#679e89" strokeWidth="1.2" fill="none" />
          <line x1="62" y1="74" x2="68" y2="74" stroke="#487868" strokeWidth="1.5" />

          {/* Black-glass prayer beads around neck */}
          <path d="M50,82 Q64,98 78,82" stroke="#121816" strokeWidth="2.5" strokeDasharray="3,3" fill="none" />
          <circle cx="64" cy="94" r="3" fill="#080c0a" stroke="#8fcca8" strokeWidth="0.8" />

          {/* Linen-wrapped hands with inner glow */}
          <g transform="translate(50, 96)">
            <ellipse cx="14" cy="14" rx="18" ry="12" fill="#d8ebe1" stroke="#88b5a0" strokeWidth="1.5" />
            <line x1="4" y1="12" x2="24" y2="12" stroke="#99bfae" strokeWidth="1.2" />
            <line x1="6" y1="16" x2="22" y2="16" stroke="#99bfae" strokeWidth="1.2" />
            {/* Inner glow pulsing through linen */}
            <circle cx="14" cy="14" r="9" fill="url(#mirene-glow)" />
          </g>
        </svg>
      );

    case "barris-the-smith":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="barris-bg" cx="60%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#452714" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#1f1008" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0d0603" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#barris-bg)" />

          {/* Forge Amber Light */}
          <circle cx="86" cy="64" r="48" fill="#ff8c3b" opacity="0.14" />

          {/* Broken Sword over Shoulder */}
          <g transform="translate(78, 16) rotate(32)">
            <rect x="-4" y="0" width="8" height="28" fill="#7a8594" stroke="#252a32" strokeWidth="1.5" />
            <polygon points="-4,28 0,38 4,28 2,22 -2,22" fill="#586370" />
            <rect x="-10" y="28" width="20" height="4" fill="#3a2414" stroke="#1a1008" strokeWidth="1" />
            <rect x="-2" y="32" width="4" height="12" fill="#20150d" />
            <circle cx="0" cy="46" r="3" fill="#8a6428" />
          </g>

          {/* Broad Shoulders & Heavy Torso */}
          <path d="M16,128 L28,76 L100,76 L112,128 Z" fill="#2b231d" />

          {/* Soot-stiff Blacksmith Apron */}
          <path d="M42,80 L86,80 L92,128 L36,128 Z" fill="#5a3d24" stroke="#2b1b0e" strokeWidth="1.5" />
          <line x1="42" y1="80" x2="32" y2="70" stroke="#3d2714" strokeWidth="3" />
          <line x1="86" y1="80" x2="96" y2="70" stroke="#3d2714" strokeWidth="3" />
          <circle cx="54" cy="98" r="5" fill="#1a1410" opacity="0.4" />
          <circle cx="76" cy="112" r="7" fill="#1a1410" opacity="0.4" />

          {/* Head & Neck */}
          <path d="M52,54 L52,76 L76,76 L76,54 Z" fill="#b88d6c" />
          <path d="M48,36 Q64,28 80,36 Q86,52 82,68 Q64,74 46,68 Q42,52 48,36 Z" fill="#c79c78" />

          {/* Cropped Iron-Grey Hair & Beard */}
          <path d="M46,38 Q64,24 82,38 Q78,32 64,30 Q50,32 46,38 Z" fill="#71757e" />
          <path d="M44,56 Q40,84 64,88 Q88,84 84,56 Q82,72 64,76 Q46,72 44,56 Z" fill="#656973" />
          <path d="M52,66 Q64,70 76,66 Q74,72 64,74 Q54,72 52,66 Z" fill="#50545c" />

          {/* Facial Features (weathered smith) */}
          <ellipse cx="56" cy="48" rx="2" ry="1.5" fill="#2c1a0e" />
          <ellipse cx="72" cy="48" rx="2" ry="1.5" fill="#2c1a0e" />
          <path d="M52,44 L60,46" stroke="#4a3020" strokeWidth="2" />
          <path d="M76,44 L68,46" stroke="#4a3020" strokeWidth="2" />
          <path d="M64,48 L62,56 L67,56" stroke="#825a3d" strokeWidth="1.5" fill="none" />
          {/* Scar across cheek */}
          <line x1="50" y1="52" x2="58" y2="60" stroke="#7a4234" strokeWidth="1.2" />

          {/* Smith's Hammer at belt */}
          <g transform="translate(30, 96) rotate(-25)">
            <rect x="0" y="0" width="6" height="28" fill="#80562e" stroke="#2e1a0b" strokeWidth="1" />
            <rect x="-6" y="-6" width="18" height="10" rx="1" fill="#697482" stroke="#1d222a" strokeWidth="1.2" />
          </g>
        </svg>
      );

    case "kiln-master-vance":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="vance-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#4a200e" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#220c04" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0c0401" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#vance-bg)" />

          {/* Kiln Glow & Ash Specks */}
          <circle cx="64" cy="70" r="50" fill="#ff6a1a" opacity="0.16" />
          <circle cx="28" cy="40" r="1" fill="#ffcf99" opacity="0.6" />
          <circle cx="98" cy="52" r="1.2" fill="#ffcf99" opacity="0.5" />
          <circle cx="44" cy="88" r="1" fill="#ffcf99" opacity="0.4" />

          {/* Charcoal Cloak dusted in pale ash */}
          <path d="M24,128 L36,74 Q64,80 92,74 L104,128 Z" fill="#222026" stroke="#121114" strokeWidth="1.5" />
          <path d="M30,86 Q46,78 64,86 Q82,78 98,86" stroke="#9ca0a8" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Head & Hood */}
          <path d="M38,42 Q64,22 90,42 Q96,74 88,92 Q64,98 40,92 Q32,74 38,42 Z" fill="#2e2b33" />

          {/* Ember Goggles */}
          <g transform="translate(46, 46)">
            <rect x="0" y="0" width="16" height="12" rx="4" fill="#693b1e" stroke="#1f1008" strokeWidth="1.5" />
            <circle cx="8" cy="6" r="4" fill="#ff6b08" />
            <circle cx="8" cy="6" r="2" fill="#fff099" />
            <rect x="20" y="0" width="16" height="12" rx="4" fill="#693b1e" stroke="#1f1008" strokeWidth="1.5" />
            <circle cx="28" cy="6" r="4" fill="#ff6b08" />
            <circle cx="28" cy="6" r="2" fill="#fff099" />
            <line x1="16" y1="6" x2="20" y2="6" stroke="#1f1008" strokeWidth="2" />
            <line x1="-8" y1="6" x2="0" y2="6" stroke="#1f1008" strokeWidth="2" />
            <line x1="36" y1="6" x2="44" y2="6" stroke="#1f1008" strokeWidth="2" />
          </g>

          {/* Copper Half-Mask across lower face */}
          <path d="M48,64 L80,64 L74,84 Q64,90 54,84 Z" fill="#b86c3b" stroke="#522b11" strokeWidth="1.5" />
          <line x1="64" y1="64" x2="64" y2="86" stroke="#87471d" strokeWidth="1.5" />
          <circle cx="56" cy="74" r="1.5" fill="#381c0b" />
          <circle cx="72" cy="74" r="1.5" fill="#381c0b" />

          {/* Tally Hook Cane */}
          <g transform="translate(86, 76)">
            <line x1="0" y1="0" x2="6" y2="52" stroke="#59463b" strokeWidth="3" />
            <path d="M0,0 Q-10,-12 4,-12 Q14,-12 8,2" fill="none" stroke="#b08d4a" strokeWidth="2.5" />
          </g>
        </svg>
      );

    case "cinder-nurse-greta":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="greta-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#3d1b14" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#1f0a07" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0a0302" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#greta-bg)" />

          {/* Rust-red Coat */}
          <path d="M28,128 L38,76 Q64,82 90,76 L100,128 Z" fill="#6e2b20" stroke="#33100a" strokeWidth="1.5" />
          <path d="M50,78 L64,128 L78,78 Z" fill="#8c392b" />

          {/* Cropped Dark Curls */}
          <circle cx="48" cy="42" r="8" fill="#211512" />
          <circle cx="58" cy="36" r="8" fill="#211512" />
          <circle cx="70" cy="36" r="8" fill="#211512" />
          <circle cx="80" cy="42" r="8" fill="#211512" />
          <circle cx="44" cy="52" r="7" fill="#211512" />
          <circle cx="84" cy="52" r="7" fill="#211512" />

          {/* Singed Linen Nurse Cap */}
          <path d="M46,32 Q64,24 82,32 L86,44 Q64,40 42,44 Z" fill="#d9cfbe" stroke="#5c4832" strokeWidth="1.2" />
          <polygon points="44,34 49,32 46,38" fill="#241a10" />
          <line x1="64" y1="30" x2="64" y2="38" stroke="#873528" strokeWidth="1.5" />
          <line x1="60" y1="34" x2="68" y2="34" stroke="#873528" strokeWidth="1.5" />

          {/* Face */}
          <path d="M50,48 Q64,42 78,48 Q82,64 74,74 Q64,80 54,74 Q46,64 50,48 Z" fill="#dfaf92" />
          <ellipse cx="58" cy="56" rx="2" ry="1.5" fill="#382115" />
          <ellipse cx="70" cy="56" rx="2" ry="1.5" fill="#382115" />
          <path d="M64,58 L63,64 L66,64" stroke="#9e6e52" strokeWidth="1.2" fill="none" />
          <line x1="60" y1="69" x2="68" y2="69" stroke="#7a3e2c" strokeWidth="1.5" />

          {/* Blue Glass Flask at Hip */}
          <g transform="translate(86, 92)">
            <rect x="4" y="0" width="6" height="4" fill="#a4c8e8" />
            <path d="M2,4 L12,4 L15,20 Q15,26 7,26 Q-1,26 0,20 Z" fill="#2b6fb5" stroke="#123b66" strokeWidth="1.2" />
            <ellipse cx="7" cy="18" rx="5" ry="3" fill="#68aef5" opacity="0.6" />
          </g>

          {/* Pale Sulfur Work Gloves */}
          <g transform="translate(36, 96)">
            <rect x="0" y="0" width="16" height="20" rx="4" fill="#d6c669" stroke="#5e541b" strokeWidth="1.5" />
            <line x1="4" y1="4" x2="12" y2="4" stroke="#ad9e3e" strokeWidth="1.5" />
          </g>
        </svg>
      );

    case "elodie-outrunner":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="elodie-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#3d2417" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#1a0e08" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#080402" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#elodie-bg)" />

          {/* Hooked Ravine Staff */}
          <g transform="translate(94, 20)">
            <line x1="0" y1="0" x2="0" y2="108" stroke="#473629" strokeWidth="3" />
            <path d="M0,0 Q-10,-10 0,-16 Q8,-10 4,-2" fill="none" stroke="#876848" strokeWidth="2.5" />
            <polygon points="-6,-6 -2,-12 -8,-10" fill="#a88967" />
          </g>

          {/* Patched Red Climbing Coat */}
          <path d="M30,128 L40,78 Q64,84 88,78 L98,128 Z" fill="#8f3227" stroke="#38110c" strokeWidth="1.5" />
          <polygon points="46,92 58,92 56,104 44,104" fill="#543729" stroke="#291a13" strokeWidth="1" />

          {/* Ash-Grey Scarf with fluttering ends */}
          <path d="M42,66 Q64,74 86,66 Q90,82 64,86 Q38,82 42,66 Z" fill="#696c73" stroke="#2f3136" strokeWidth="1.5" />
          <path d="M74,78 Q88,92 84,112 Q76,108 72,82 Z" fill="#565961" />

          {/* Head & One Shaved Temple */}
          <path d="M50,44 Q64,36 78,44 Q82,60 74,70 Q64,76 54,70 Q46,60 50,44 Z" fill="#d49f7e" />
          {/* Shaved temple (right side stubble) */}
          <path d="M72,40 Q78,46 76,54 L72,52 Q72,44 68,42 Z" fill="#59463c" opacity="0.7" />
          {/* Dark windswept hair (left side) */}
          <path d="M46,42 Q56,26 70,36 Q60,34 52,42 Q46,50 48,58 Z" fill="#241913" />

          {/* Lean, determined face */}
          <ellipse cx="58" cy="52" rx="2" ry="1.5" fill="#301d13" />
          <ellipse cx="68" cy="52" rx="2" ry="1.5" fill="#301d13" />
          <path d="M54,48 L62,50" stroke="#301d13" strokeWidth="1.8" />
          <path d="M72,48 L66,50" stroke="#301d13" strokeWidth="1.8" />
          <path d="M64,54 L62,60 L66,60" stroke="#875638" strokeWidth="1.2" fill="none" />
          <line x1="60" y1="65" x2="68" y2="65" stroke="#753526" strokeWidth="1.5" />
        </svg>
      );

    case "mistress-morveth":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="morveth-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#142c38" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#08151c" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#02070a" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#morveth-bg)" />

          {/* Storm-water Oilskin Mantle */}
          <path d="M26,128 L36,74 Q64,80 92,74 L102,128 Z" fill="#284852" stroke="#102026" strokeWidth="1.5" />
          <path d="M40,78 Q64,86 88,78 L92,128 L36,128 Z" fill="#355e6b" />

          {/* Braided White Sea-Hair over shoulder */}
          <path d="M74,48 Q86,64 80,94 Q76,96 74,90 Q78,68 70,52 Z" fill="#e8edf0" stroke="#a4b0b8" strokeWidth="1" />
          <line x1="77" y1="62" x2="81" y2="66" stroke="#94a1a8" strokeWidth="1" />
          <line x1="76" y1="74" x2="80" y2="78" stroke="#94a1a8" strokeWidth="1" />
          <line x1="75" y1="84" x2="79" y2="88" stroke="#94a1a8" strokeWidth="1" />

          {/* Head & Weathered Skin */}
          <path d="M48,46 Q64,36 80,46 Q84,64 76,74 Q64,80 52,74 Q46,64 48,46 Z" fill="#cfab91" />

          {/* Brass Diving Goggles on Forehead */}
          <g transform="translate(48, 38)">
            <ellipse cx="8" cy="4" rx="7" ry="5" fill="#243338" stroke="#a8853b" strokeWidth="2" />
            <ellipse cx="24" cy="4" rx="7" ry="5" fill="#243338" stroke="#a8853b" strokeWidth="2" />
            <line x1="15" y1="4" x2="17" y2="4" stroke="#a8853b" strokeWidth="2" />
            <path d="M1" y1="4" x2="-8" y2="6" stroke="#241a10" strokeWidth="2" />
            <path d="M31" y1="4" x2="40" y2="6" stroke="#241a10" strokeWidth="2" />
          </g>

          {/* Piercing Sea-grey Eyes */}
          <ellipse cx="56" cy="56" rx="2" ry="1.5" fill="#3a5661" />
          <ellipse cx="70" cy="56" rx="2" ry="1.5" fill="#3a5661" />
          <path d="M63,58 L62,65 L66,65" stroke="#876149" strokeWidth="1.2" fill="none" />
          <line x1="58" y1="70" x2="68" y2="70" stroke="#754b35" strokeWidth="1.5" />

          {/* Name-Tags Stitched onto Sleeves */}
          <rect x="32" y="90" width="12" height="6" fill="#f0ebd8" stroke="#332415" strokeWidth="1" />
          <line x1="34" y1="93" x2="42" y2="93" stroke="#21170d" strokeWidth="0.8" />
          <rect x="34" y="102" width="12" height="6" fill="#f0ebd8" stroke="#332415" strokeWidth="1" />
          <line x1="36" y1="105" x2="44" y2="105" stroke="#21170d" strokeWidth="0.8" />
        </svg>
      );

    case "sister-lyra":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="lyra-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#143b35" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#081c19" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#020a09" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#lyra-bg)" />

          {/* Layered Kelp-Green Robes */}
          <path d="M26,128 L36,78 Q64,84 92,78 L102,128 Z" fill="#204a3e" stroke="#0e241e" strokeWidth="1.5" />
          <path d="M42,80 L64,128 L86,80 Z" fill="#326e5d" />

          {/* Shaved Head & Pearl Ear Cuffs */}
          <path d="M48,46 Q64,30 80,46 Q84,66 76,76 Q64,82 52,76 Q44,66 48,46 Z" fill="#dfbe9f" />
          {/* Pearl ear cuffs */}
          <circle cx="45" cy="54" r="2.5" fill="#f0f7f4" stroke="#7ac4a7" strokeWidth="0.8" />
          <circle cx="44" cy="60" r="2" fill="#f0f7f4" stroke="#7ac4a7" strokeWidth="0.8" />
          <circle cx="83" cy="54" r="2.5" fill="#f0f7f4" stroke="#7ac4a7" strokeWidth="0.8" />
          <circle cx="84" cy="60" r="2" fill="#f0f7f4" stroke="#7ac4a7" strokeWidth="0.8" />

          {/* Calm Healer Eyes */}
          <path d="M54,56 Q58,60 62,56" stroke="#255245" strokeWidth="1.5" fill="none" />
          <path d="M66,56 Q70,60 74,56" stroke="#255245" strokeWidth="1.5" fill="none" />
          <path d="M64,59 L63,66 L66,66" stroke="#967054" strokeWidth="1.2" fill="none" />
          <line x1="60" y1="72" x2="68" y2="72" stroke="#87473a" strokeWidth="1.5" />

          {/* Netted Satchel with Glowing Mint Salve Jars */}
          <g transform="translate(76, 92)">
            <rect x="0" y="0" width="28" height="24" rx="4" fill="#38281c" stroke="#17100b" strokeWidth="1.5" />
            <line x1="0" y1="6" x2="28" y2="6" stroke="#7d593d" strokeWidth="1" />
            <line x1="0" y1="14" x2="28" y2="14" stroke="#7d593d" strokeWidth="1" />
            {/* Glowing Jars in net */}
            <circle cx="7" cy="10" r="4" fill="#69f0be" stroke="#247858" strokeWidth="1" />
            <circle cx="14" cy="12" r="4" fill="#69f0be" stroke="#247858" strokeWidth="1" />
            <circle cx="21" cy="10" r="4" fill="#69f0be" stroke="#247858" strokeWidth="1" />
          </g>
        </svg>
      );

    case "kieran-blind-oar":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="kieran-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#1a283d" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#0a121f" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#03060d" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#kieran-bg)" />

          {/* Carved Oar Staff upright */}
          <g transform="translate(94, 8)">
            <line x1="0" y1="0" x2="0" y2="120" stroke="#735233" strokeWidth="4" />
            <path d="M-6,0 L6,0 L8,36 Q8,48 0,54 Q-8,48 -6,36 Z" fill="#8f6b47" stroke="#422c19" strokeWidth="1.5" />
            <line x1="0" y1="4" x2="0" y2="44" stroke="#523924" strokeWidth="1.5" />
          </g>

          {/* Salt-bleached Blue Pea-Coat */}
          <path d="M24,128 L36,76 Q64,82 92,76 L102,128 Z" fill="#2d4059" stroke="#121d2b" strokeWidth="1.5" />
          <path d="M36,92 L50,86 L78,86 L92,92 L86,128 L42,128 Z" fill="#3b5373" />
          <circle cx="48" cy="98" r="2.5" fill="#c4aa6c" />
          <circle cx="48" cy="112" r="2.5" fill="#c4aa6c" />

          {/* Rope Coil across chest */}
          <path d="M38,82 Q64,106 88,88" stroke="#b09977" strokeWidth="3" fill="none" />
          <path d="M36,88 Q64,112 86,94" stroke="#9c8462" strokeWidth="3" fill="none" />

          {/* Weathered Face & Salt Stubble */}
          <path d="M48,46 Q64,36 80,46 Q84,66 76,76 Q64,82 52,76 Q44,66 48,46 Z" fill="#c79a7b" />
          <path d="M46,40 Q64,28 82,40 Q76,34 64,32 Q52,34 46,40 Z" fill="#8d9aa6" />
          <path d="M50,68 Q64,78 78,68 Q74,76 64,78 Q54,76 50,68 Z" fill="#8d9aa6" opacity="0.6" />

          {/* Eye Wrap / Clouded Eyes */}
          <path d="M46,50 L82,50 L80,59 L48,59 Z" fill="#d9d5cb" stroke="#706a5e" strokeWidth="1" />
          <line x1="46" y1="55" x2="82" y2="55" stroke="#a39c8e" strokeWidth="1" />
          <path d="M64,60 L62,67 L66,67" stroke="#8c5b3b" strokeWidth="1.2" fill="none" />
          <line x1="58" y1="72" x2="68" y2="72" stroke="#7a3f33" strokeWidth="1.5" />
        </svg>
      );

    case "reeve-toran":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="toran-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#301c45" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#150a21" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#07030a" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#toran-bg)" />

          {/* Violet Mantle & Scholars Robes */}
          <path d="M26,128 L38,76 Q64,82 90,76 L102,128 Z" fill="#35224d" stroke="#160c21" strokeWidth="1.5" />
          <path d="M44,78 L64,128 L84,78 Z" fill="#4d336e" />

          {/* Gaunt Face & Wind-tossed Black Hair */}
          <path d="M44,42 Q64,22 84,36 Q92,48 84,54 Q74,38 60,34 Q46,42 44,42 Z" fill="#1b1724" />
          <path d="M38,48 Q46,38 52,52 L44,62 Z" fill="#1b1724" />
          <path d="M50,46 Q64,38 78,46 Q80,68 74,78 Q64,84 54,78 Q46,68 50,46 Z" fill="#d9c2b0" />

          {/* Cracked Brass Monocle on Left Eye */}
          <g transform="translate(54, 52)">
            <circle cx="6" cy="6" r="6" fill="#182333" stroke="#cca647" strokeWidth="1.5" />
            <circle cx="6" cy="6" r="4" fill="#a8cde8" opacity="0.4" />
            {/* Crack lines across glass */}
            <line x1="2" y1="2" x2="8" y2="7" stroke="#e8f4fc" strokeWidth="1" />
            <line x1="8" y1="7" x2="11" y2="10" stroke="#e8f4fc" strokeWidth="0.8" />
            {/* Monocle chain */}
            <path d="M12,6 Q18,18 20,32" stroke="#cca647" strokeWidth="1" fill="none" />
          </g>

          {/* Other Eye (wide, haunted stargazer) */}
          <ellipse cx="72" cy="58" rx="2.5" ry="2" fill="#1e1829" />
          <circle cx="73" cy="57" r="0.8" fill="#ffffff" />
          <path d="M64,61 L63,68 L66,68" stroke="#997055" strokeWidth="1.2" fill="none" />
          <line x1="60" y1="74" x2="68" y2="74" stroke="#7a3f45" strokeWidth="1.5" />

          {/* Brass Telescope Lens cradled in arm */}
          <g transform="translate(80, 88) rotate(-15)">
            <rect x="0" y="0" width="18" height="32" rx="3" fill="#302619" stroke="#ba923a" strokeWidth="1.5" />
            <ellipse cx="9" cy="4" rx="7" ry="3" fill="#b0d8f5" stroke="#ba923a" strokeWidth="1" />
          </g>
        </svg>
      );

    case "hermit-cassian":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="cassian-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#2b1c3b" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#120a1c" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#050208" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#cassian-bg)" />

          {/* Plum Hooded Coat */}
          <path d="M26,128 L36,76 Q64,82 92,76 L102,128 Z" fill="#3d2847" stroke="#170c1c" strokeWidth="1.5" />
          <path d="M38,44 Q64,22 90,44 Q96,74 88,94 Q64,100 40,94 Q32,74 38,44 Z" fill="#4f335c" />
          <path d="M44,48 Q64,30 84,48 Q88,72 82,90 Q64,96 46,90 Z" fill="#362140" />

          {/* Face */}
          <path d="M52,50 Q64,42 76,50 Q80,66 74,74 Q64,80 54,74 Q48,66 52,50 Z" fill="#d1b297" />

          {/* Close Silver Beard */}
          <path d="M48,58 Q44,82 64,86 Q84,82 80,58 Q76,70 64,74 Q52,70 48,58 Z" fill="#bdc3cc" />

          {/* Eyes (gentle, contemplative) */}
          <ellipse cx="58" cy="56" rx="2" ry="1.5" fill="#362b22" />
          <ellipse cx="70" cy="56" rx="2" ry="1.5" fill="#362b22" />
          <path d="M64,58 L63,64 L66,64" stroke="#875e40" strokeWidth="1.2" fill="none" />

          {/* Moss in Sleeves */}
          <ellipse cx="38" cy="98" rx="6" ry="4" fill="#4d7042" stroke="#25381f" strokeWidth="1" />
          <ellipse cx="90" cy="98" rx="6" ry="4" fill="#4d7042" stroke="#25381f" strokeWidth="1" />

          {/* Meteorite Bowl of Glowing Spring Water */}
          <g transform="translate(48, 98)">
            <ellipse cx="16" cy="14" rx="20" ry="10" fill="#29262e" stroke="#121114" strokeWidth="2" />
            <ellipse cx="16" cy="12" rx="16" ry="7" fill="#8f76cf" />
            <ellipse cx="16" cy="12" rx="11" ry="4" fill="#cbbcf0" opacity="0.8" />
          </g>
        </svg>
      );

    case "mina-drift-child":
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <radialGradient id="mina-bg" cx="50%" cy="50%" r="90%">
              <stop offset="0%" stopColor="#251a36" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#100a1a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#040208" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="128" height="128" fill="url(#mina-bg)" />

          {/* Lavender Ambience & Silver Sparks */}
          <circle cx="64" cy="64" r="46" fill="#b18fed" opacity="0.1" />
          <circle cx="36" cy="38" r="1.5" fill="#ffffff" opacity="0.8" />
          <circle cx="92" cy="44" r="1" fill="#e0d4fc" opacity="0.7" />
          <circle cx="82" cy="88" r="1.2" fill="#ffffff" opacity="0.8" />

          {/* Oversized Charcoal Cloak with Meteor-Glass Beads */}
          <path d="M30,128 L40,82 Q64,86 88,82 L98,128 Z" fill="#201e24" stroke="#0e0d10" strokeWidth="1.5" />
          <path d="M36,54 Q64,28 92,54 Q98,82 92,106 Q64,114 36,106 Q30,82 36,54 Z" fill="#2b2830" />

          {/* Meteor-glass beads sewn into cloak */}
          <circle cx="44" cy="76" r="2" fill="#d2b8ff" stroke="#fff" strokeWidth="0.5" />
          <circle cx="52" cy="88" r="2.5" fill="#a4f0d6" stroke="#fff" strokeWidth="0.5" />
          <circle cx="84" cy="78" r="2" fill="#d2b8ff" stroke="#fff" strokeWidth="0.5" />
          <circle cx="76" cy="90" r="2.5" fill="#ffd1b3" stroke="#fff" strokeWidth="0.5" />

          {/* Pale Braids */}
          <path d="M46,58 Q40,78 44,98 Q48,98 48,88 Q48,68 50,58 Z" fill="#ded7ec" stroke="#9a90b3" strokeWidth="1" />
          <path d="M82,58 Q88,78 84,98 Q80,98 80,88 Q80,68 78,58 Z" fill="#ded7ec" stroke="#9a90b3" strokeWidth="1" />

          {/* Small Child Face */}
          <path d="M52,56 Q64,48 76,56 Q80,72 74,80 Q64,86 54,80 Q48,72 52,56 Z" fill="#edd6cb" />

          {/* Ink-Dark Eyes (large, perceptive) */}
          <ellipse cx="58" cy="65" rx="3.5" ry="4" fill="#140f1a" />
          <circle cx="57" cy="63" r="1.2" fill="#ffffff" />
          <ellipse cx="70" cy="65" rx="3.5" ry="4" fill="#140f1a" />
          <circle cx="69" cy="63" r="1.2" fill="#ffffff" />

          <line x1="62" y1="76" x2="66" y2="76" stroke="#87564c" strokeWidth="1.5" />

          {/* Silver Tuning Fork held upright */}
          <g transform="translate(86, 70)">
            <line x1="6" y1="16" x2="6" y2="34" stroke="#c2c7d4" strokeWidth="2.5" />
            <path d="M0,0 L0,14 Q6,18 12,14 L12,0" fill="none" stroke="#dbe0eb" strokeWidth="2" />
            {/* Acoustic rings */}
            <path d="M-4,-2 Q6,-6 16,-2" stroke="#b49ced" strokeWidth="1" fill="none" opacity="0.6" />
          </g>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <rect width="128" height="128" fill="#111116" />
          <circle cx="64" cy="64" r="36" fill="#222530" />
          <path d="M40,110 Q64,88 88,110" fill="#303545" />
          <circle cx="64" cy="56" r="16" fill="#454c60" />
        </svg>
      );
  }
}
