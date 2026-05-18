import { useCallback, useMemo, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";

const sanitizeBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

export const useMusicXmlPanels = () => {
  const [isDrawerPinned, setIsDrawerPinned] = usePersistentState<boolean>(
    "melodicatrainer_drawer_pinned",
    true,
    { sanitize: sanitizeBoolean },
  );
  const [isRightDrawerPinned, setIsRightDrawerPinned] = usePersistentState<boolean>(
    "melodicatrainer_right_drawer_pinned",
    true,
    { sanitize: sanitizeBoolean },
  );
  const [isTopDrawerPinned, setIsTopDrawerPinned] = usePersistentState<boolean>(
    "melodicatrainer_top_drawer_pinned",
    true,
    { sanitize: sanitizeBoolean },
  );

  const [isDrawerHovered, setIsDrawerHovered] = useState(false);
  const [isRightDrawerHovered, setIsRightDrawerHovered] = useState(false);
  const [isTopDrawerHovered, setIsTopDrawerHovered] = useState(false);

  const areAllPinned = isDrawerPinned && isRightDrawerPinned && isTopDrawerPinned;
  const topDrawerHidden = !isTopDrawerPinned && !isTopDrawerHovered;

  const toggleAllPanels = useCallback(() => {
    const targetState = !areAllPinned;
    setIsDrawerPinned(targetState);
    setIsRightDrawerPinned(targetState);
    setIsTopDrawerPinned(targetState);
    window.dispatchEvent(
      new CustomEvent("toggle-all-panels", { detail: { pinned: targetState } }),
    );
  }, [
    areAllPinned,
    setIsDrawerPinned,
    setIsRightDrawerPinned,
    setIsTopDrawerPinned,
  ]);

  return useMemo(
    () => ({
      areAllPinned,
      isDrawerHovered,
      isDrawerPinned,
      isRightDrawerHovered,
      isRightDrawerPinned,
      isTopDrawerHovered,
      isTopDrawerPinned,
      setIsDrawerHovered,
      setIsDrawerPinned,
      setIsRightDrawerHovered,
      setIsRightDrawerPinned,
      setIsTopDrawerHovered,
      setIsTopDrawerPinned,
      toggleAllPanels,
      topDrawerHidden,
    }),
    [
      areAllPinned,
      isDrawerHovered,
      isDrawerPinned,
      isRightDrawerHovered,
      isRightDrawerPinned,
      isTopDrawerHovered,
      isTopDrawerPinned,
      setIsDrawerPinned,
      setIsRightDrawerPinned,
      setIsTopDrawerPinned,
      toggleAllPanels,
      topDrawerHidden,
    ],
  );
};
