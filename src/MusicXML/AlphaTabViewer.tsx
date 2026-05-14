import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as alphaTab from "@coderline/alphatab";
import { parseAlphaTabScore } from "./alphaTabParser";
import { onAlphaTabEvent, onAlphaTabEventOf } from "./alphaTabEvents";
import { createAlphaTabSettings } from "./alphaTabSettings";
import { getAutoFitZoom, measureRenderedContentHeight } from "./alphaTabAutoFit";
import {
    applySelectedTrackRenderState,
    getSelectedTrack,
    getTracksInfo,
    hideScoreHeaderFooter,
    type TrackInfo,
} from "./alphaTabTrack";
import { musicXmlDebugLogger } from "./debugLogger";
import type { PlaybackEvent } from "./types";

type WindowWithAlphaTabDebug = Window & {
    alphaTabApi?: alphaTab.AlphaTabApi;
    alphaTabScore?: alphaTab.model.Score;
};

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
    harmonicaKey: string;
    isPlaybackActive?: boolean;
    trackIndex?: number;
    transpose?: number;
    onScoreLoaded: (events: PlaybackEvent[], score: alphaTab.model.Score, tracks: TrackInfo[], tempo: number) => void;
    onTimeUpdate: (currentTimeMs: number) => void;
    onPlaybackFinished: () => void;
    onRenderedHeightChange?: (heightPx: number) => void;
    onReadyChange?: (isReady: boolean) => void;
}

const AlphaTabViewer = forwardRef<AlphaTabViewerRef, AlphaTabViewerProps>(({ 
    fileData, 
    harmonicaKey,
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
    const harmonicaKeyRef = useRef(harmonicaKey);
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
        harmonicaKeyRef.current = harmonicaKey;
        isPlaybackActiveRef.current = isPlaybackActive;
        trackIndexRef.current = trackIndex;
        transposeRef.current = transpose;
    }, [harmonicaKey, isPlaybackActive, onPlaybackFinished, onReadyChange, onRenderedHeightChange, onScoreLoaded, onTimeUpdate, trackIndex, transpose]);

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
        setTempo: (tempo: number) => {
            if (apiRef.current) {
                apiRef.current.playbackSpeed = tempo / 100;
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

    useEffect(() => {
        if (!alphaTabRef.current || !containerRef.current || !fileData) return;

        let api: alphaTab.AlphaTabApi | null = null;
        onReadyChangeRef.current?.(false);
        lastTickRef.current = 0;
        resetAutoFitZoom();

        try {
            const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, '') + '/';
            const sfPath = `${baseUrl}soundfont/sonivox.sf2`;
            
            musicXmlDebugLogger.log("AlphaTab: Initializing API core...");

            api = new alphaTab.AlphaTabApi(
                alphaTabRef.current,
                createAlphaTabSettings({
                    baseUrl,
                    scrollElement: containerRef.current,
                    soundFontPath: sfPath,
                })
            );

            apiRef.current = api;
            (window as WindowWithAlphaTabDebug).alphaTabApi = api;

            const scheduleAutoFit = () => {
                if (autoFitFrameRef.current !== null) {
                    window.cancelAnimationFrame(autoFitFrameRef.current);
                }

                autoFitFrameRef.current = window.requestAnimationFrame(() => {
                    autoFitFrameRef.current = null;

                    const scoreZoomElement = scoreZoomRef.current;
                    const scoreElement = alphaTabRef.current;
                    const containerElement = containerRef.current;
                    if (apiRef.current !== api || !scoreZoomElement || !scoreElement || !containerElement) return;

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
            };

            const notifyScoreLoaded = (score: alphaTab.model.Score) => {
                const selected = getSelectedTrack(score, trackIndexRef.current);
                const selectedTrackIndex = selected?.index ?? 0;
                const { events, tempo } = parseAlphaTabScore(score, harmonicaKeyRef.current, selectedTrackIndex, transposeRef.current);
                onScoreLoadedRef.current(events, score, getTracksInfo(score), tempo);
            };

            onAlphaTabEventOf(api.scoreLoaded, (score) => {
                musicXmlDebugLogger.log("AlphaTab: Score loaded into API.");
                (window as WindowWithAlphaTabDebug).alphaTabScore = score;
                hideScoreHeaderFooter(score);

                try {
                    if (renderFrameRef.current !== null) {
                        window.cancelAnimationFrame(renderFrameRef.current);
                    }
                    renderFrameRef.current = window.requestAnimationFrame(() => {
                        renderFrameRef.current = null;
                        try {
                            applySelectedTrackRenderState(api, trackIndexRef.current, transposeRef.current);
                        } catch {
                            musicXmlDebugLogger.warn("AlphaTab: Failed to apply selected track.");
                        }
                    });
                } catch {
                    musicXmlDebugLogger.warn("AlphaTab: Failed to apply selected track.");
                }
                
                notifyScoreLoaded(score);
            });

            onAlphaTabEvent(api.postRenderFinished, () => {
                musicXmlDebugLogger.log("AlphaTab: Render finished.");
                scheduleAutoFit();
            });

            onAlphaTabEvent(api.playerReady, () => {
                musicXmlDebugLogger.log("AlphaTab: Player ready.");
                onReadyChangeRef.current?.(true);
                if (lastTickRef.current > 0) {
                    api!.tickPosition = lastTickRef.current;
                }
            });

            onAlphaTabEventOf(api.playerPositionChanged, (args) => {
                lastTickRef.current = args.currentTick;
                onTimeUpdateRef.current(args.currentTick);
                if (!isPlaybackActiveRef.current) return;

                // Internal Centered Scrolling
                const container = containerRef.current;
                const cursor = alphaTabRef.current?.querySelector(".at-cursor-beat") as HTMLElement;
                if (container && cursor) {
                    const containerRect = container.getBoundingClientRect();
                    const cursorRect = cursor.getBoundingClientRect();
                    const targetLeft = containerRect.width * 0.4;
                    const offset = cursorRect.left - containerRect.left - targetLeft;

                    // We use direct manipulation for speed during playback
                    container.scrollLeft = Math.max(0, container.scrollLeft + offset);
                }
            });
            onAlphaTabEvent(api.playerFinished, () => onPlaybackFinishedRef.current());

            let dataToLoad: string | Uint8Array = fileData;
            if (typeof fileData !== 'string' && !(fileData instanceof Uint8Array)) {
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
                    delete (window as WindowWithAlphaTabDebug).alphaTabApi;
                }
                onReadyChangeRef.current?.(false);
            }
        };
    }, [fileData, resetAutoFitZoom]);


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
            const { events, tempo } = parseAlphaTabScore(currentApi.score, harmonicaKey, selectedTrackIndex, transpose);
            onScoreLoadedRef.current(events, currentApi.score, getTracksInfo(currentApi.score), tempo);
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
    }, [harmonicaKey, transpose, trackIndex, resetAutoFitZoom]);

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
