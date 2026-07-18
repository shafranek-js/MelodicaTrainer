import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as alphaTab from "@coderline/alphatab";
import { buildAlphaTabPlaybackSelection } from "./alphaTabParser";
import {
    applySelectedTrackRenderState,
    getTracksInfo,
    type TrackInfo,
} from "./alphaTabTrack";
import { musicXmlDebugLogger } from "./debugLogger";
import { useAlphaTabApi } from "./useAlphaTabApi";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";
import type { AccompanimentTrack } from "./accompaniment";

export interface AlphaTabViewerRef {
    playPause: () => void;
    stop: () => void;
    setTempo: (tempo: number) => void;
    setTickPosition: (tick: number) => void;
    isReadyForPlayback: () => boolean;
    getCursorElement: () => HTMLElement | null;
}

interface AlphaTabViewerProps {
    fileData: string | Uint8Array;
    keyCount: MelodicaKeyCount;
    isPlaybackActive?: boolean;
    trackIndex?: number;
    transpose?: number;
    onScoreLoaded: (
        events: PlaybackEvent[],
        score: alphaTab.model.Score,
        tracks: TrackInfo[],
        tempo: number,
        accompanimentTracks: AccompanimentTrack[],
        accompanimentWarnings: string[],
    ) => void;
    onTimeUpdate: (currentTimeMs: number) => void;
    onPlaybackFinished: () => void;
    onRenderedHeightChange?: (heightPx: number) => void;
    onReadyChange?: (isReady: boolean) => void;
}

const AlphaTabViewer = forwardRef<AlphaTabViewerRef, AlphaTabViewerProps>(({ 
    fileData, 
    keyCount,
    isPlaybackActive = false,
    trackIndex = 0,
    transpose = 0,
    onScoreLoaded, 
    onTimeUpdate, 
    onPlaybackFinished,
    onRenderedHeightChange,
    onReadyChange
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scoreZoomRef = useRef<HTMLDivElement>(null);
    const alphaTabRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
    const lastTickRef = useRef(0);
    const onScoreLoadedRef = useRef(onScoreLoaded);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onPlaybackFinishedRef = useRef(onPlaybackFinished);
    const onRenderedHeightChangeRef = useRef(onRenderedHeightChange);
    const onReadyChangeRef = useRef(onReadyChange);
    const keyCountRef = useRef(keyCount);
    const isPlaybackActiveRef = useRef(isPlaybackActive);
    const trackIndexRef = useRef(trackIndex);
    const transposeRef = useRef(transpose);
    const renderFrameRef = useRef<number | null>(null);
    const autoFitFrameRef = useRef<number | null>(null);

    const resetAutoFitZoom = useCallback(() => {
        scoreZoomRef.current?.style.removeProperty("zoom");
    }, []);

    useEffect(() => {
        onScoreLoadedRef.current = onScoreLoaded;
        onTimeUpdateRef.current = onTimeUpdate;
        onPlaybackFinishedRef.current = onPlaybackFinished;
        onRenderedHeightChangeRef.current = onRenderedHeightChange;
        onReadyChangeRef.current = onReadyChange;
        keyCountRef.current = keyCount;
        isPlaybackActiveRef.current = isPlaybackActive;
        trackIndexRef.current = trackIndex;
        transposeRef.current = transpose;
    }, [isPlaybackActive, keyCount, onPlaybackFinished, onReadyChange, onRenderedHeightChange, onScoreLoaded, onTimeUpdate, trackIndex, transpose]);

    useImperativeHandle(ref, () => ({
        playPause: () => {
            const api = apiRef.current;
            if (api?.isReadyForPlayback) {
                try {
                    api.playPause();
                } catch (e) {
                    console.error("AlphaTab: Playback error", e);
                }
            } else {
                musicXmlDebugLogger.warn(`AlphaTab: Cannot play. Ready: ${api?.isReadyForPlayback ?? false}, API: ${!!api}`);
            }
        },
        stop: () => {
            if (apiRef.current) {
                try {
                    if (apiRef.current.playerState !== 0) {
                        apiRef.current.stop();
                    }
                } catch (e) {
                    musicXmlDebugLogger.warn("AlphaTab: Stop error", e);
                }
            }
        },
        setTempo: (tempoScale: number) => {
            if (apiRef.current) {
                apiRef.current.playbackSpeed = tempoScale;
            }
        },
        setTickPosition: (tick: number) => {
            if (apiRef.current) {
                apiRef.current.tickPosition = Math.max(0, Math.round(tick));
            }
        },
        isReadyForPlayback: () => apiRef.current?.isReadyForPlayback ?? false,
        getCursorElement: () => {
            return alphaTabRef.current?.querySelector(".at-cursor-beat") as HTMLElement || null;
        }
    }));

    useAlphaTabApi({
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
    });

    useEffect(() => {
        const api = apiRef.current;
        if (!api?.score) return;

        const track = api.score.tracks[trackIndex] || api.score.tracks[0];
        if (!track) return;

        if (renderFrameRef.current !== null) {
            window.cancelAnimationFrame(renderFrameRef.current);
        }
        if (autoFitFrameRef.current !== null) {
            window.cancelAnimationFrame(autoFitFrameRef.current);
            autoFitFrameRef.current = null;
        }
        resetAutoFitZoom();

        renderFrameRef.current = window.requestAnimationFrame(() => {
            renderFrameRef.current = null;
            const currentApi = apiRef.current;
            if (!currentApi?.score) return;

            const currentTrack = currentApi.score.tracks[trackIndex] || currentApi.score.tracks[0];
            if (!currentTrack) return;

            try {
                applySelectedTrackRenderState(currentApi, trackIndex, transpose);
            } catch {
                musicXmlDebugLogger.warn("AlphaTab: Failed to update track render state.");
            }

            const selectedTrackIndex = Math.max(0, currentApi.score.tracks.indexOf(currentTrack));
            const playback = buildAlphaTabPlaybackSelection(
                currentApi.score,
                keyCount,
                selectedTrackIndex,
                transpose,
            );
            onScoreLoadedRef.current(
                playback.events,
                currentApi.score,
                getTracksInfo(currentApi.score),
                playback.tempo,
                playback.accompanimentTracks,
                playback.accompanimentWarnings,
            );
        });

        return () => {
            if (renderFrameRef.current !== null) {
                window.cancelAnimationFrame(renderFrameRef.current);
                renderFrameRef.current = null;
            }
            if (autoFitFrameRef.current !== null) {
                window.cancelAnimationFrame(autoFitFrameRef.current);
                autoFitFrameRef.current = null;
            }
        };
    }, [keyCount, transpose, trackIndex, resetAutoFitZoom]);

    useEffect(() => {
        return () => {
            if (renderFrameRef.current !== null) {
                window.cancelAnimationFrame(renderFrameRef.current);
                renderFrameRef.current = null;
            }
            if (autoFitFrameRef.current !== null) {
                window.cancelAnimationFrame(autoFitFrameRef.current);
                autoFitFrameRef.current = null;
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="h-full w-full bg-gray-900 overflow-y-hidden overflow-x-auto relative scrollbar-hide">
            <div ref={scoreZoomRef} className="w-full origin-top-left">
                <div ref={alphaTabRef} className="min-w-max alpha-tab-dark" />
            </div>
        </div>
    );
});

export default AlphaTabViewer;
