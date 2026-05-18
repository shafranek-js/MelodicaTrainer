import { useEffect, useRef, useState } from "react";

type UseEndStatsOverlayOptions = {
  isPlaying: boolean;
  topDrawerHidden: boolean;
};

export const useEndStatsOverlay = ({
  isPlaying,
  topDrawerHidden,
}: UseEndStatsOverlayOptions) => {
  const [showEndStats, setShowEndStats] = useState(false);
  const prevPlayingRef = useRef(isPlaying);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = isPlaying;
    if (!wasPlaying || isPlaying) return;
    if (topDrawerHidden) {
      setShowEndStats(true);
    }
  }, [isPlaying, topDrawerHidden]);

  useEffect(() => {
    if (!showEndStats) return;
    const dismiss = () => setShowEndStats(false);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("click", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("click", dismiss);
    };
  }, [showEndStats]);

  return {
    dismissEndStats: () => setShowEndStats(false),
    showEndStats,
  };
};
