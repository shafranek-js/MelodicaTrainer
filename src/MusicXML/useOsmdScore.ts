import { useEffect, useRef } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { ScoreFormat } from "./scoreFormat";

type UseOsmdScoreOptions = {
  displayFileContent: string | null;
  scoreFormat: ScoreFormat | null;
  onRenderError: (error: unknown) => void;
  onRendered: () => void;
};

export const useOsmdScore = ({
  displayFileContent,
  scoreFormat,
  onRenderError,
  onRendered,
}: UseOsmdScoreOptions) => {
  const osmdRef = useRef<HTMLDivElement>(null);
  const osmdInstanceRef = useRef<OpenSheetMusicDisplay | null>(null);
  const osmdContainerRef = useRef<HTMLDivElement | null>(null);
  const renderRunRef = useRef(0);

  useEffect(() => {
    const container = osmdRef.current;
    if (
      (scoreFormat !== "musicxml" && scoreFormat !== "midi") ||
      !displayFileContent ||
      !container
    ) {
      osmdInstanceRef.current?.clear();
      osmdInstanceRef.current = null;
      osmdContainerRef.current = null;
      return;
    }

    const renderRun = renderRunRef.current + 1;
    renderRunRef.current = renderRun;

    if (!osmdInstanceRef.current || osmdContainerRef.current !== container) {
      osmdInstanceRef.current?.clear();
      osmdContainerRef.current = container;
      osmdInstanceRef.current = new OpenSheetMusicDisplay(container, {
        backend: "svg",
        drawTitle: true,
        drawComposer: true,
        drawFingerings: true,
        fingeringPosition: "below",
        autoResize: false,
        followCursor: true,
        renderSingleHorizontalStaffline: true,
        cursorsOptions: [{ type: CursorType.ThinLeft, color: "#10b981", alpha: 0.85, follow: true }],
      });
    }

    osmdInstanceRef.current
      .load(displayFileContent)
      .then(() => {
        if (renderRunRef.current !== renderRun) return;
        osmdInstanceRef.current?.render();
        onRendered();
      })
      .catch((error: unknown) => {
        if (renderRunRef.current !== renderRun) return;
        onRenderError(error);
      });
  }, [displayFileContent, onRenderError, onRendered, scoreFormat]);

  return {
    osmdInstanceRef,
    osmdRef,
  };
};
