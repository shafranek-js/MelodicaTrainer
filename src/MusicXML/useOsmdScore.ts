import { useEffect, useRef } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";

type UseOsmdScoreOptions = {
  displayFileContent: string | null;
  isGpFile: boolean;
  onRendered: () => void;
};

export const useOsmdScore = ({
  displayFileContent,
  isGpFile,
  onRendered,
}: UseOsmdScoreOptions) => {
  const osmdRef = useRef<HTMLDivElement>(null);
  const osmdInstanceRef = useRef<OpenSheetMusicDisplay | null>(null);
  const renderRunRef = useRef(0);

  useEffect(() => {
    if (isGpFile || !displayFileContent || !osmdRef.current) return;

    const renderRun = renderRunRef.current + 1;
    renderRunRef.current = renderRun;

    if (!osmdInstanceRef.current) {
      osmdInstanceRef.current = new OpenSheetMusicDisplay(osmdRef.current, {
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

    osmdInstanceRef.current.load(displayFileContent).then(() => {
      if (renderRunRef.current !== renderRun) return;
      osmdInstanceRef.current?.render();
      onRendered();
    });
  }, [displayFileContent, isGpFile, onRendered]);

  return {
    osmdInstanceRef,
    osmdRef,
  };
};
