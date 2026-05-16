import type { FingerVisualState } from "./usePhantomHand";

const FINGER_STATE_CLASS: Record<FingerVisualState, string> = {
  idle: "opacity-[0.25] saturate-50 transition-all duration-500",
  prepare: "opacity-[0.8] saturate-100 brightness-110 drop-shadow-[0_0_12px_rgba(255,255,255,0.5)] transition-all duration-150",
  pressing: "opacity-100 saturate-150 brightness-125 drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] transition-all duration-75",
};

type PhantomHandProps = {
  fingerStates: FingerVisualState[];
  visible: boolean;
  className?: string;
};

/**
 * Renders a sleek, glassmorphism phantom hand SVG over the keyboard.
 * Each finger is controlled independently via CSS classes derived from
 * fingerStates[0..4].
 */
export const PhantomHand = ({ fingerStates, visible, className = "" }: PhantomHandProps) => {
  if (!visible) return null;

  return (
    <div
      className={`absolute inset-x-0 bottom-6 pointer-events-none flex justify-center ${className}`}
      style={{ zIndex: 45 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 210"
        className="h-64 sm:h-72 w-auto max-w-full drop-shadow-2xl"
        fill="none"
      >
        <defs>
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
          <linearGradient id="highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="80%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>
        </defs>

        {/* 
          Finger 1: Thumb 
          Base: (50, 145) -> Tip: (15, 95)
        */}
        <g className={FINGER_STATE_CLASS[fingerStates[0]]}>
          <line x1="50" y1="145" x2="15" y2="95" stroke="rgba(255,255,255,0.15)" strokeWidth="26" strokeLinecap="round" />
          <line x1="50" y1="145" x2="15" y2="95" stroke="url(#glassGradient)" strokeWidth="22" strokeLinecap="round" />
          <line x1="48" y1="140" x2="13" y2="95" stroke="url(#highlight)" strokeWidth="6" strokeLinecap="round" />
        </g>

        {/* 
          Finger 2: Index 
          Base: (70, 115) -> Tip: (55, 35)
        */}
        <g className={FINGER_STATE_CLASS[fingerStates[1]]}>
          <line x1="70" y1="115" x2="55" y2="35" stroke="rgba(255,255,255,0.15)" strokeWidth="22" strokeLinecap="round" />
          <line x1="70" y1="115" x2="55" y2="35" stroke="url(#glassGradient)" strokeWidth="18" strokeLinecap="round" />
          <line x1="68" y1="110" x2="53" y2="35" stroke="url(#highlight)" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* 
          Finger 3: Middle 
          Base: (100, 110) -> Tip: (100, 20)
        */}
        <g className={FINGER_STATE_CLASS[fingerStates[2]]}>
          <line x1="100" y1="110" x2="100" y2="20" stroke="rgba(255,255,255,0.15)" strokeWidth="22" strokeLinecap="round" />
          <line x1="100" y1="110" x2="100" y2="20" stroke="url(#glassGradient)" strokeWidth="18" strokeLinecap="round" />
          <line x1="98" y1="105" x2="98" y2="20" stroke="url(#highlight)" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* 
          Finger 4: Ring 
          Base: (130, 115) -> Tip: (140, 35)
        */}
        <g className={FINGER_STATE_CLASS[fingerStates[3]]}>
          <line x1="130" y1="115" x2="140" y2="35" stroke="rgba(255,255,255,0.15)" strokeWidth="20" strokeLinecap="round" />
          <line x1="130" y1="115" x2="140" y2="35" stroke="url(#glassGradient)" strokeWidth="16" strokeLinecap="round" />
          <line x1="128" y1="110" x2="138" y2="35" stroke="url(#highlight)" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* 
          Finger 5: Pinky 
          Base: (155, 130) -> Tip: (175, 70)
        */}
        <g className={FINGER_STATE_CLASS[fingerStates[4]]}>
          <line x1="155" y1="130" x2="175" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="18" strokeLinecap="round" />
          <line x1="155" y1="130" x2="175" y2="70" stroke="url(#glassGradient)" strokeWidth="14" strokeLinecap="round" />
          <line x1="153" y1="125" x2="173" y2="70" stroke="url(#highlight)" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Palm */}
        <g className="opacity-90">
          <path 
            d="M 45 145 Q 70 110 100 110 Q 130 110 160 135 Q 165 170 130 195 Q 100 200 70 195 Q 40 180 45 145 Z" 
            fill="url(#glassGradient)" 
            stroke="rgba(255,255,255,0.3)" 
            strokeWidth="3" 
          />
          {/* Inner specular knuckle highlight */}
          <path 
            d="M 50 145 Q 72 115 100 115 Q 128 115 155 137" 
            fill="none" 
            stroke="rgba(255,255,255,0.7)" 
            strokeWidth="3" 
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};
