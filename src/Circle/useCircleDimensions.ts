import { useEffect, useState } from "react";

export const getResponsiveSize = () => {
  const width = window.innerWidth;
  if (width < 400) return { radius: 100, center: 120 };
  if (width < 640) return { radius: 120, center: 140 };
  if (width < 768) return { radius: 140, center: 160 };
  return { radius: 160, center: 180 };
};

export const useCircleDimensions = () => {
  const [dimensions, setDimensions] = useState(getResponsiveSize);

  useEffect(() => {
    const handleResize = () => setDimensions(getResponsiveSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return dimensions;
};
