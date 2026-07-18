import { useEffect, useRef } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { ScoreFormat } from "./scoreFormat";

type UseOsmdScoreOptions = {
  displayFileContent: string | null;
  scoreFormat: ScoreFormat | null;
  onRenderError: (error: unknown) => void;
  onRendered: () => void;
  onRenderedHeightChange: (heightPx: number) => void;
};

const MIN_SCORE_HEIGHT_PX = 96;
const SCORE_VERTICAL_PADDING_PX = 8;
export const SINGLE_LINE_SHEET_MAX_WIDTH = 1_000_000;

type SingleLineEngravingRules = {
  SheetMaximumWidth: number;
};

export const configureSingleLineSheetWidth = (
  rules: SingleLineEngravingRules,
): void => {
  // OSMD's default cap is close to the historical SVG limit of 32767 px.
  // Long scores then wrap even with renderSingleHorizontalStaffline enabled.
  // The SVG backend supports a larger cap and keeps the natural score width.
  rules.SheetMaximumWidth = SINGLE_LINE_SHEET_MAX_WIDTH;
};

export const getOsmdRenderedHeight = (container: HTMLElement): number => {
  const renderedHeight = Math.max(
    0,
    ...Array.from(container.querySelectorAll("svg"))
      .filter((svg) => svg.childElementCount > 0)
      .map((svg) => svg.getBoundingClientRect().height),
  );
  return renderedHeight > 0
    ? Math.max(
        MIN_SCORE_HEIGHT_PX,
        Math.ceil(renderedHeight + SCORE_VERTICAL_PADDING_PX),
      )
    : MIN_SCORE_HEIGHT_PX;
};

export const useOsmdScore = ({
  displayFileContent,
  scoreFormat,
  onRenderError,
  onRendered,
  onRenderedHeightChange,
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

    osmdInstanceRef.current?.clear();
    container.replaceChildren();
    osmdContainerRef.current = container;
    const osmd = new OpenSheetMusicDisplay(container, {
      backend: "svg",
      drawingParameters: "compacttight",
      drawCredits: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
      drawMetronomeMarks: false,
      drawPartNames: false,
      drawPartAbbreviations: false,
      drawMeasureNumbers: false,
      drawLyrics: false,
      drawFingerings: true,
      fingeringPosition: "below",
      autoResize: false,
      followCursor: true,
      renderSingleHorizontalStaffline: true,
      cursorsOptions: [{ type: CursorType.ThinLeft, color: "#10b981", alpha: 0.85, follow: true }],
    });
    configureSingleLineSheetWidth(osmd.EngravingRules);
    osmdInstanceRef.current = osmd;

    osmd
      .load(displayFileContent)
      .then(() => {
        if (renderRunRef.current !== renderRun) return;
        osmd.render();
        Array.from(container.querySelectorAll("svg")).forEach((svg) => {
          if (svg.childElementCount === 0) svg.remove();
        });
        onRenderedHeightChange(getOsmdRenderedHeight(container));
        onRendered();
      })
      .catch((error: unknown) => {
        if (renderRunRef.current !== renderRun) return;
        onRenderError(error);
      });
  }, [
    displayFileContent,
    onRenderError,
    onRendered,
    onRenderedHeightChange,
    scoreFormat,
  ]);

  return {
    osmdInstanceRef,
    osmdRef,
  };
};
