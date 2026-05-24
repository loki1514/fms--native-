/**
 * LevelBadge.tsx — Square gradient badge showing the user's numeric level.
 *
 * Responsibility: Render a glowing rounded square with the level number, and
 *   optionally a "Level N · {name}" caption beside it. Three preset sizes.
 * Used by: routes/property-admin.tsx, routes/mst.tsx (Gamify strip).
 */

interface Props {
  level: number;
  name?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { box: "h-9 w-9", num: "text-sm" },
  md: { box: "h-12 w-12", num: "text-base" },
  lg: { box: "h-16 w-16", num: "text-xl" },
};

export function LevelBadge({ level, name, size = "md" }: Props) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`relative flex ${s.box} shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[oklch(0.55_0.18_280)] to-[oklch(0.4_0.14_235)] font-bold shadow-[0_0_24px_oklch(0.55_0.18_280/45%)]`}
      >
        <span className={`text-display ${s.num} text-white`}>{level}</span>
      </div>
      {name && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Level {level}
          </div>
          <div className="text-display text-sm font-semibold leading-tight text-white">
            {name}
          </div>
        </div>
      )}
    </div>
  );
}
