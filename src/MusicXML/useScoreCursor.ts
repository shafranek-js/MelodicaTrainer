import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import { getInterpolatedGpCursorTick } from "./gpCursor";
import { styleSheetCursor } from "./sheetCursor";
import type { PlaybackEvent } from "./types";

type UseScoreCursorOptions = {
  alphaTabRef: MutableRefObject<AlphaTabViewerRef | null>;
  cursorEventIndexRef: MutableRefObject<number | null>;
  gpCursorFrameRef: MutableRefObject<number | null>;
  isGpFile: boolean;
  isPlayingRef: MutableRefObject<boolean>;
  osmdInstanceRef: MutableRefObject<OpenSheetMusicDisplay | null>;
  playbackEvents: PlaybackEvent[];
  sheetScrollRef: MutableRefObject<HTMLDivElement | null>;
};

export const useScoreCursor = ({
  alphaTabRef,
  cursorEventIndexRef,
  gpCursorFrameRef,
  isGpFile,
  isPlayingRef,
  osmdInstanceRef,
  playbackEvents,
  sheetScrollRef,
}: UseScoreCursorOptions) => {
  const stopGpCursorAnimation = useCallback(() => {
    if (gpCursorFrameRef.current !== null) {
      window.cancelAnimationFrame(gpCursorFrameRef.current);
      gpCursorFrameRef.current = null;
    }
  }, [gpCursorFrameRef]);

  const scrollSheetToCursor = useCallback(() => {
    const sheet = sheetScrollRef.current;
    if (!sheet) return;

    const cursorElement = isGpFile
      ? alphaTabRef.current?.getCursorElement()
      : osmdInstanceRef.current?.cursor?.cursorElement;

    if (!cursorElement) return;

    window.requestAnimationFrame(() => {
      const sheetRect = sheet.getBoundingClientRect();
      const cursorRect = cursorElement.getBoundingClientRect();
      const targetLeft = sheet.clientWidth * 0.4;
      const offset = cursorRect.left - sheetRect.left - targetLeft;
      sheet.scrollTo({ left: Math.max(0, sheet.scrollLeft + offset), behavior: "smooth" });
    });
  }, [alphaTabRef, isGpFile, osmdInstanceRef, sheetScrollRef]);

  const moveCursorInstantlyToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstanceRef.current?.cursor;
    if (!cursor) return;

    cursor.cursorElement.style.transition = "none";
    if (cursorEventIndexRef.current === null || eventIndex < cursorEventIndexRef.current) {
      cursor.reset();
      cursorEventIndexRef.current = 0;
    }

    cursor.show();
    for (let index = cursorEventIndexRef.current; index < eventIndex; index += 1) {
      cursor.next();
    }
    cursorEventIndexRef.current = eventIndex;
    styleSheetCursor(cursor.cursorElement, 0);
    scrollSheetToCursor();
  }, [cursorEventIndexRef, osmdInstanceRef, scrollSheetToCursor]);

  const animateGpCursorThroughEvent = useCallback((eventIndex: number, durationMs: number) => {
    if (!isGpFile) return;

    stopGpCursorAnimation();

    const event = playbackEvents[eventIndex];
    const startTick = event?.originalTick;
    if (startTick === undefined) return;

    const api = alphaTabRef.current;
    if (!api) return;

    const nextEvent = playbackEvents[eventIndex + 1];
    if (nextEvent?.originalTick === undefined || nextEvent.originalTick <= startTick || durationMs <= 0) {
      api.setTickPosition(startTick);
      return;
    }

    const startedAt = performance.now();

    const step = (now: number) => {
      const elapsedMs = now - startedAt;
      const tick = getInterpolatedGpCursorTick({
        event,
        nextEvent,
        elapsedMs,
        durationMs,
      });

      if (tick !== null) {
        api.setTickPosition(tick);
      }

      const progress = Math.min(1, elapsedMs / durationMs);
      if (progress < 1 && isPlayingRef.current) {
        gpCursorFrameRef.current = window.requestAnimationFrame(step);
      } else {
        gpCursorFrameRef.current = null;
      }
    };

    api.setTickPosition(startTick);
    gpCursorFrameRef.current = window.requestAnimationFrame(step);
  }, [alphaTabRef, gpCursorFrameRef, isGpFile, isPlayingRef, playbackEvents, stopGpCursorAnimation]);

  const moveCursorThroughEvent = useCallback((eventIndex: number, durationMs: number) => {
    const event = playbackEvents[eventIndex];
    if (!event) return;

    moveCursorInstantlyToEvent(event.sourceEventIndex);
    animateGpCursorThroughEvent(eventIndex, durationMs);

    const nextEvent = playbackEvents[eventIndex + 1];
    if (nextEvent && nextEvent.sourceEventIndex > event.sourceEventIndex) {
      const cursor = osmdInstanceRef.current?.cursor;
      if (cursor) {
        styleSheetCursor(cursor.cursorElement, durationMs);
        cursor.next();
      }
      cursorEventIndexRef.current = nextEvent.sourceEventIndex;
      scrollSheetToCursor();
    }
  }, [
    animateGpCursorThroughEvent,
    cursorEventIndexRef,
    moveCursorInstantlyToEvent,
    osmdInstanceRef,
    playbackEvents,
    scrollSheetToCursor,
  ]);

  return {
    moveCursorThroughEvent,
    scrollSheetToCursor,
    stopGpCursorAnimation,
  };
};
