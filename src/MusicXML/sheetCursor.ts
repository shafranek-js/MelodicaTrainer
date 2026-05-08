import {
  SHEET_CURSOR_MIN_HEIGHT_PX,
  SHEET_CURSOR_WIDTH_PX,
} from "./constants";

export const styleSheetCursor = (
  cursorElement: HTMLImageElement,
  durationMs: number
) => {
  const renderedHeight = cursorElement.getBoundingClientRect().height;
  const cursorHeight = Math.max(renderedHeight, SHEET_CURSOR_MIN_HEIGHT_PX);
  const verticalDurationMs = durationMs === 0 ? 0 : 160;

  cursorElement.style.transition = `left ${durationMs}ms linear, top ${verticalDurationMs}ms linear, height ${verticalDurationMs}ms linear`;
  cursorElement.style.width = `${SHEET_CURSOR_WIDTH_PX}px`;
  cursorElement.style.minWidth = `${SHEET_CURSOR_WIDTH_PX}px`;
  cursorElement.style.height = `${cursorHeight}px`;
  cursorElement.style.minHeight = `${SHEET_CURSOR_MIN_HEIGHT_PX}px`;
  cursorElement.style.objectFit = "fill";
  cursorElement.style.borderRadius = "999px";
  cursorElement.style.backgroundColor = "rgba(16, 185, 129, 0.82)";
  cursorElement.style.boxShadow =
    "0 0 0 1px rgba(6, 95, 70, 0.55), 0 0 12px rgba(16, 185, 129, 0.55)";
};
