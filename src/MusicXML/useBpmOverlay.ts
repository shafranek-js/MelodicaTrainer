import { useEffect, useState } from "react";

export const useBpmOverlay = (tempo: number) => {
  const [isBpmOverlayVisible, setIsBpmOverlayVisible] = useState(false);

  useEffect(() => {
    setIsBpmOverlayVisible(true);
    const timer = setTimeout(() => {
      setIsBpmOverlayVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [tempo]);

  return isBpmOverlayVisible;
};
