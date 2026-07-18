import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import * as alphaTab from "@coderline/alphatab";
import { buildAlphaTabPlaybackSelection } from "./alphaTabParser";
import { createAlphaTabSettings } from "./alphaTabSettings";
import { getAutoFitZoom, measureRenderedContentHeight } from "./alphaTabAutoFit";
import { getSelectedTrack, getTracksInfo, type TrackInfo } from "./alphaTabTrack";
import { musicXmlDebugLogger } from "./debugLogger";
import { useAlphaTabEvents } from "./useAlphaTabEvents";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";
import type { AccompanimentTrack } from "./accompaniment";

type WindowWithAlphaTabApiDebug = Window & {
  alphaTabApi?: alphaTab.AlphaTabApi;
};

type UseAlphaTabApiOptions = {
  alphaTabRef: MutableRefObject<HTMLDivElement | null>;
  apiRef: MutableRefObject<alphaTab.AlphaTabApi | null>;
  autoFitFrameRef: MutableRefObject<number | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  fileData: string | Uint8Array;
  isPlaybackActiveRef: MutableRefObject<boolean>;
  keyCountRef: MutableRefObject<MelodicaKeyCount>;
  lastTickRef: MutableRefObject<number>;
  onPlaybackFinishedRef: MutableRefObject<() => void>;
  onReadyChangeRef: MutableRefObject<((isReady: boolean) => void) | undefined>;
  onRenderedHeightChangeRef: MutableRefObject<
    ((heightPx: number) => void) | undefined
  >;
  onScoreLoadedRef: MutableRefObject<
    (
      events: PlaybackEvent[],
      score: alphaTab.model.Score,
      tracks: TrackInfo[],
      tempo: number,
      accompanimentTracks: AccompanimentTrack[],
      accompanimentWarnings: string[],
    ) => void
  >;
  onTimeUpdateRef: MutableRefObject<(currentTimeMs: number) => void>;
  renderFrameRef: MutableRefObject<number | null>;
  resetAutoFitZoom: () => void;
  scoreZoomRef: MutableRefObject<HTMLDivElement | null>;
  trackIndexRef: MutableRefObject<number>;
  transposeRef: MutableRefObject<number>;
};

export const useAlphaTabApi = ({
  alphaTabRef,
  apiRef,
  autoFitFrameRef,
  containerRef,
  fileData,
  isPlaybackActiveRef,
  keyCountRef,
  lastTickRef,
  onPlaybackFinishedRef,
  onReadyChangeRef,
  onRenderedHeightChangeRef,
  onScoreLoadedRef,
  onTimeUpdateRef,
  renderFrameRef,
  resetAutoFitZoom,
  scoreZoomRef,
  trackIndexRef,
  transposeRef,
}: UseAlphaTabApiOptions) => {
  const scheduleAutoFit = useCallback(
    (api: alphaTab.AlphaTabApi) => {
      if (autoFitFrameRef.current !== null) {
        window.cancelAnimationFrame(autoFitFrameRef.current);
      }

      autoFitFrameRef.current = window.requestAnimationFrame(() => {
        autoFitFrameRef.current = null;

        const scoreZoomElement = scoreZoomRef.current;
        const scoreElement = alphaTabRef.current;
        const containerElement = containerRef.current;
        if (
          apiRef.current !== api ||
          !scoreZoomElement ||
          !scoreElement ||
          !containerElement
        ) {
          return;
        }

        resetAutoFitZoom();
        const availableHeight = containerElement.clientHeight;
        const renderedHeight = measureRenderedContentHeight(scoreElement);
        if (renderedHeight > 0) {
          onRenderedHeightChangeRef.current?.(renderedHeight);
        }
        const nextZoom = getAutoFitZoom(availableHeight, renderedHeight);
        if (nextZoom === null) {
          return;
        }

        scoreZoomElement.style.setProperty("zoom", String(nextZoom));
      });
    },
    [
      alphaTabRef,
      apiRef,
      autoFitFrameRef,
      containerRef,
      onRenderedHeightChangeRef,
      resetAutoFitZoom,
      scoreZoomRef,
    ],
  );

  const notifyScoreLoaded = useCallback(
    (score: alphaTab.model.Score) => {
      const selected = getSelectedTrack(score, trackIndexRef.current);
      const selectedTrackIndex = selected?.index ?? 0;
      const playback = buildAlphaTabPlaybackSelection(
        score,
        keyCountRef.current,
        selectedTrackIndex,
        transposeRef.current,
      );
      onScoreLoadedRef.current(
        playback.events,
        score,
        getTracksInfo(score),
        playback.tempo,
        playback.accompanimentTracks,
        playback.accompanimentWarnings,
      );
    },
    [keyCountRef, onScoreLoadedRef, trackIndexRef, transposeRef],
  );

  const wireAlphaTabEvents = useAlphaTabEvents({
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
  });

  useEffect(() => {
    if (!alphaTabRef.current || !containerRef.current || !fileData) return;

    const setNotReady = () => onReadyChangeRef.current?.(false);
    let api: alphaTab.AlphaTabApi | null = null;
    setNotReady();
    lastTickRef.current = 0;
    resetAutoFitZoom();

    try {
      const baseUrl = `${(import.meta.env.BASE_URL || "/").replace(/\/+$/, "")}/`;
      const sfPath = `${baseUrl}soundfont/sonivox.sf2`;

      musicXmlDebugLogger.log("AlphaTab: Initializing API core...");

      api = new alphaTab.AlphaTabApi(
        alphaTabRef.current,
        createAlphaTabSettings({
          baseUrl,
          scrollElement: containerRef.current,
          soundFontPath: sfPath,
        }),
      );

      apiRef.current = api;
      (window as WindowWithAlphaTabApiDebug).alphaTabApi = api;

      wireAlphaTabEvents(api);

      let dataToLoad: string | Uint8Array = fileData;
      if (typeof fileData !== "string" && !(fileData instanceof Uint8Array)) {
        dataToLoad = new Uint8Array(Object.values(fileData));
      }

      api.load(dataToLoad);
    } catch (e) {
      console.error("AlphaTab: API Init Error", e);
    }

    return () => {
      if (api) {
        musicXmlDebugLogger.log("AlphaTab: Destroying API instance");
        if (renderFrameRef.current !== null) {
          window.cancelAnimationFrame(renderFrameRef.current);
          renderFrameRef.current = null;
        }
        if (autoFitFrameRef.current !== null) {
          window.cancelAnimationFrame(autoFitFrameRef.current);
          autoFitFrameRef.current = null;
        }
        resetAutoFitZoom();
        try {
          api.destroy();
        } catch {
          musicXmlDebugLogger.warn("AlphaTab: Destroy failed.");
        }
        if (apiRef.current === api) {
          apiRef.current = null;
          delete (window as WindowWithAlphaTabApiDebug).alphaTabApi;
        }
        setNotReady();
      }
    };
  }, [
    alphaTabRef,
    apiRef,
    autoFitFrameRef,
    containerRef,
    fileData,
    lastTickRef,
    onReadyChangeRef,
    renderFrameRef,
    resetAutoFitZoom,
    wireAlphaTabEvents,
  ]);
};
