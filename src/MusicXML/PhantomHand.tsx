import type { FingerVisualState } from "./usePhantomHand";

const FINGER_TIPS: { cx: number; cy: number; r: number }[] = [
  { cx: 15, cy: 95, r: 7 },   // Thumb
  { cx: 55, cy: 35, r: 6 },   // Index
  { cx: 100, cy: 20, r: 6 },  // Middle
  { cx: 140, cy: 35, r: 5 },  // Ring
  { cx: 175, cy: 70, r: 5 },  // Pinky
];

const FINGER_GLOW: Record<FingerVisualState, string> = {
  idle: "opacity-0",
  prepare: "opacity-70",
  pressing: "opacity-70",
};

type PhantomHandProps = {
  fingerStates: FingerVisualState[];
  visible: boolean;
  handOffsetPct?: number;
  className?: string;
};

export const PhantomHand = ({ fingerStates, visible, handOffsetPct = 0, className = "" }: PhantomHandProps) => {
  if (!visible) return null;

  return (
    <div
      className={`absolute inset-x-0 pointer-events-none flex justify-center overflow-visible ${className}`}
      style={{ zIndex: 45, bottom: "-134px" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 210"
        className="h-[332px] sm:h-[374px] w-auto max-w-full"
        style={{
          transform: `translateX(${handOffsetPct}%)`,
          transformOrigin: "bottom center",
          transition: "transform 200ms ease-out",
        }}
      >
        <defs>
          {/* Soft radial glow under fingertips */}
          <radialGradient id="fingerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Glow circles UNDER the hand */}
        {FINGER_TIPS.map((tip, i) => (
          <circle
            key={`finger-glow-${i}`}
            cx={tip.cx}
            cy={tip.cy}
            r={tip.r * 2.5}
            fill="url(#fingerGlow)"
            className={`transition-all duration-150 ${FINGER_GLOW[fingerStates[i]]}`}
          />
        ))}

        {/* Hand image ON TOP of the glow */}
        <image
          href={`${import.meta.env.BASE_URL}phantom-hand.png`}
          x="0" y="0"
          width="200" height="210"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
};
