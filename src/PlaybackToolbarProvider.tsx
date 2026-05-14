import { useState } from "react";
import type { ReactNode } from "react";
import {
  PlaybackToolbarContext,
  type PlaybackToolbarState,
} from "./PlaybackToolbarContext";

export const PlaybackToolbarProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PlaybackToolbarState | null>(null);

  return (
    <PlaybackToolbarContext.Provider value={{ state, setState }}>
      {children}
    </PlaybackToolbarContext.Provider>
  );
};
