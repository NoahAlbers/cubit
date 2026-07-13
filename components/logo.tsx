import { cn } from "@/lib/utils";

/**
 * Melbourne Makerspace gear-and-swoosh mark, recreated as inline SVG.
 * Blue 8-tooth gear with an open center; red orbit swoosh sweeping
 * through it from lower-left to upper-right.
 */
export function LogoMark({
  className,
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  const blue = mono ? "currentColor" : "#094FA4";
  const red = mono ? "currentColor" : "#C5122F";
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <mask id="gear-hole">
        <rect width="100" height="100" fill="white" />
        <circle cx="50" cy="50" r="21" fill="black" />
      </mask>
      <g mask="url(#gear-hole)">
        <circle cx="50" cy="50" r="36" fill={blue} />
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="42.5"
            y="2"
            width="15"
            height="18"
            rx="5"
            fill={blue}
            transform={`rotate(${i * 45 + 22.5} 50 50)`}
          />
        ))}
      </g>
      {/* Orbit swoosh: tapered ribbon rising through the gear */}
      <path
        d="M2 79 C 26 78, 52 68, 68 52 C 80 40, 88 26, 92 10 C 94 18, 93 30, 87 42 C 78 60, 60 74, 38 80 C 26 83, 12 83, 2 79 Z"
        fill={red}
      />
    </svg>
  );
}

/**
 * Full logo lockup: gear mark + stacked wordmark in the display face.
 */
export function Logo({
  className,
  markClassName,
  textClassName,
  onDark = false,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-9 w-9", onDark && "text-white", markClassName)} mono={onDark} />
      <span className={cn("flex flex-col leading-none", textClassName)}>
        <span
          className={cn(
            "font-display text-[0.95rem] font-bold tracking-[0.06em]",
            onDark ? "text-white" : "text-brand-blue"
          )}
        >
          MELBOURNE
        </span>
        <span
          className={cn(
            "font-display text-[0.95rem] font-bold tracking-[0.06em]",
            onDark ? "text-white" : "text-brand-blue"
          )}
        >
          MAKERSPACE
        </span>
        <span
          className={cn(
            "mt-0.5 font-display text-[0.5rem] tracking-[0.28em]",
            onDark ? "text-white/70" : "text-brand-red"
          )}
        >
          FLORIDA&thinsp;–&thinsp;USA
        </span>
      </span>
    </span>
  );
}

/** Product wordmark for the app chrome: "CUBIT" in the display face. */
export function CubitWordmark({
  className,
  sub,
  onDark = false,
}: {
  className?: string;
  sub?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-8 w-8", onDark && "text-white")} mono={onDark} />
      <span className="flex flex-col justify-center leading-none">
        <span
          className={cn(
            "font-display text-lg font-bold tracking-[0.12em]",
            onDark ? "text-white" : "text-brand-blue"
          )}
        >
          CUBIT
        </span>
        {sub && (
          <span
            className={cn(
              "mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.22em]",
              onDark ? "text-white/60" : "text-muted-foreground"
            )}
          >
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
