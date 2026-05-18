import { useCallback } from "react";
import type { MutableRefObject } from "react";
import * as alphaTab from "@coderline/alphatab";
import { onAlphaTabEvent, onAlphaTabEventOf } from "./alphaTabEvents";
import { applySelectedTrackRenderState, hideScoreHeaderFooter } from "./alphaTabTrack";
import { musicXmlDebugLogger } from "./debugLogger";

type WindowWithAlphaTabScoreDebug = Window & {
  alphaTabScore?: alphaTab.model.Score;
};

type UseAlphaTabEventsOptions = {
  alphaTabRef: MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isPlaybackActiveRef: MutableRefObject<boolean>;
  lastTickRef: MutableRefObject<number>;
  onPlaybackFinishedRef: MutableRefObject<() => void>;
  onReadyChangeRef: MutableRefObject<((isReady: boolean) => void) | undefined>;
  onTimeUpdateRef: MutableRefObject<(currentTimeMs: number) => void>;
  renderFrameRef: MutableRefObject<number | null>;
  scheduleAutoFit: (api: alphaTab.AlphaTabApi) => void;
  notifyScoreLoaded: (score: alphaTab.model.Score) => void;
  trackIndexRef: MutableRefObject<number>;
  transposeRef: MutableRefObject<number>;
};

export const useAlphaTabEvents = ({
  alphaTabRef,
  containerRef,
  isPlaybackActiveRef,
  lastTickRef,
  onPlaybackFinishedRef,
  onReadyChangeRef,
  onTimeUpdateRef,
  renderFrameRef,
  scheduleAutoFit,
  notifyScoreLoaded,
  trackIndexRef,
  transposeRef,
}: UseAlphaTabEventsOptions) =>
  useCallback(
    (api: alphaTab.AlphaTabApi) => {
      onAlphaTabEventOf(api.scoreLoaded, (score) => {
        musicXmlDebugLogger.log("AlphaTab: Score loaded into API.");
        (window as WindowWithAlphaTabScoreDebug).alphaTabScore = score;
        hideScoreHeaderFooter(score);

        try {
          if (renderFrameRef.current !== null) {
            window.cancelAnimationFrame(renderFrameRef.current);
          }
          renderFrameRef.current = window.requestAnimationFrame(() => {
            renderFrameRef.current = null;
            try {
              applySelectedTrackRenderState(
                api,
                trackIndexRef.current,
                transposeRef.current,
              );
            } catch {
              musicXmlDebugLogger.warn(
                "AlphaTab: Failed to apply selected track.",
              );
            }
          });
        } catch {
          musicXmlDebugLogger.warn("AlphaTab: Failed to apply selected track.");
        }

        notifyScoreLoaded(score);
      });

      onAlphaTabEvent(api.postRenderFinished, () => {
        musicXmlDebugLogger.log("AlphaTab: Render finished.");
        scheduleAutoFit(api);
      });

      onAlphaTabEvent(api.playerReady, () => {
        musicXmlDebugLogger.log("AlphaTab: Player ready.");
        onReadyChangeRef.current?.(true);
        if (lastTickRef.current > 0) {
          api.tickPosition = lastTickRef.current;
        }
      });

      onAlphaTabEventOf(api.playerPositionChanged, (args) => {
        lastTickRef.current = args.currentTick;
        onTimeUpdateRef.current(args.currentTick);
        if (!isPlaybackActiveRef.current) return;

        const container = containerRef.current;
        const cursor = alphaTabRef.current?.querySelector(
          ".at-cursor-beat",
        ) as HTMLElement;
        if (container && cursor) {
          const containerRect = container.getBoundingClientRect();
          const cursorRect = cursor.getBoundingClientRect();
          const targetLeft = containerRect.width * 0.4;
          const offset = cursorRect.left - containerRect.left - targetLeft;

          container.scrollLeft = Math.max(0, container.scrollLeft + offset);
        }
      });

      onAlphaTabEvent(api.playerFinished, () =>
        onPlaybackFinishedRef.current(),
      );
    },
    [
      alphaTabRef,
      containerRef,
      isPlaybackActiveRef,
      lastTickRef,
      notifyScoreLoaded,
      onPlaybackFinishedRef,
      onReadyChangeRef,
      onTimeUpdateRef,
      renderFrameRef,
      scheduleAutoFit,
      trackIndexRef,
      transposeRef,
    ],
  );
