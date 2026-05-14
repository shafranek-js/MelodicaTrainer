import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as alphaTab from "@coderline/alphatab";
import { parseAlphaTabScore } from "./alphaTabParser";
import { onAlphaTabEvent, onAlphaTabEventOf } from "./alphaTabEvents";
import { applyHarmonicaNotationView, createAlphaTabSettings } from "./alphaTabSettings";
import type { PlaybackEvent } from "./types";

type WindowWithAlphaTabDebug = Window & {
    alphaTabApi?: alphaTab.AlphaTabApi;
    alphaTabScore?: alphaTab.model.Score;
};

type TrackInfo = {
    index: number;
    name: string;
};

const MIN_AUTO_FIT_ZOOM = 0.65;
const AUTO_FIT_PADDING = 0.96;

type HeaderFooterStyle = {
    isVisible?: boolean;
};

const isVisibleCanvasPixel = (data: Uint8ClampedArray, offset: number) => {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];

    return alpha > 12 && !(red > 245 && green > 245 && blue > 245);
};

const getCanvasVisibleHeight = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || canvas.width <= 0 || canvas.height <= 0) return null;

    try {
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let y = canvas.height - 1; y >= 0; y -= 1) {
            const rowOffset = y * canvas.width * 4;
            for (let x = 0; x < canvas.width; x += 1) {
                if (isVisibleCanvasPixel(data, rowOffset + x * 4)) {
                    return y + 1;
                }
            }
        }
    } catch {
        return null;
    }

    return null;
};

const measureRenderedContentHeight = (scoreElement: HTMLDivElement) => {
    const scoreRect = scoreElement.getBoundingClientRect();
    let bottom = 0;

    scoreElement.querySelectorAll("canvas").forEach((canvas) => {
        const visibleHeight = getCanvasVisibleHeight(canvas);
        if (visibleHeight === null) return;

        const canvasRect = canvas.getBoundingClientRect();
        const scaleY = canvas.height > 0 ? canvasRect.height / canvas.height : 1;
        const canvasTop = canvasRect.top - scoreRect.top;
        bottom = Math.max(bottom, canvasTop + visibleHeight * scaleY);
    });

    return bottom > 0 ? bottom : scoreElement.scrollHeight;
};

const setTrackTranspositionPitch = (
    api: alphaTab.AlphaTabApi,
    track: alphaTab.model.Track,
    semitones: number
) => {
    const selectedTrackIndex = api.score?.tracks.indexOf(track) ?? -1;
    if (selectedTrackIndex < 0) return;

    const transpositionPitches = [...(api.settings.notation.transpositionPitches ?? [])];
    while (transpositionPitches.length <= selectedTrackIndex) {
        transpositionPitches.push(0);
    }
    transpositionPitches[selectedTrackIndex] = semitones;
    api.settings.notation.transpositionPitches = transpositionPitches;
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
        trackIndexRef.current = trackIndex;
        transposeRef.current = transpose;
    }, [harmonicaKey, onPlaybackFinished, onReadyChange, onRenderedHeightChange, onScoreLoaded, onTimeUpdate, trackIndex, transpose]);

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
                console.warn(`AlphaTab: Cannot play. Ready: ${api?.isReadyForPlayback ?? false}, API: ${!!api}`);
            }
        },
        stop: () => {
            if (apiRef.current) {
                try {
                    if (apiRef.current.playerState !== 0) {
                        apiRef.current.stop();
                    }
                } catch (e) {
                    console.warn("AlphaTab: Stop error", e);
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
        resetAutoFitZoom();

        try {
            const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, '') + '/';
            const sfPath = `${baseUrl}soundfont/sonivox.sf2`;
            
            console.log(`AlphaTab: Initializing API core...`);

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

            const getSelectedTrack = (score: alphaTab.model.Score, selectedTrackIndex: number) => {
                const track = score.tracks[selectedTrackIndex] || score.tracks[0];
                if (!track) return null;
                return {
                    track,
                    index: Math.max(0, score.tracks.indexOf(track))
                };
            };

            const getTracksInfo = (score: alphaTab.model.Score): TrackInfo[] =>
                score.tracks.map((t, i) => ({ index: i, name: t.name }));

            const hideScoreHeaderFooter = (score: alphaTab.model.Score) => {
                score.style?.headerAndFooter?.forEach((style: HeaderFooterStyle) => {
                    style.isVisible = false;
                });
            };

            const applySelectedTrack = (selectedTrackIndex: number, semitones: number) => {
                const currentApi = api;
                if (!currentApi?.score) return;
                const selection = getSelectedTrack(currentApi.score, selectedTrackIndex);
                if (!selection) return;
                const { track } = selection;

                applyHarmonicaNotationView(track);
                setTrackTranspositionPitch(currentApi, track, semitones);
                currentApi.changeTrackSolo([track], true);
                currentApi.score.tracks.forEach(t => currentApi.changeTrackMute([t], t !== track));
                currentApi.renderTracks([track]);
                currentApi.loadMidiForScore();
            };

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
                    const availableHeight = containerElement.clientHeight * AUTO_FIT_PADDING;
                    const renderedHeight = measureRenderedContentHeight(scoreElement);
                    if (renderedHeight > 0) {
                        onRenderedHeightChangeRef.current?.(renderedHeight);
                    }
                    if (availableHeight <= 0 || renderedHeight <= availableHeight) {
                        return;
                    }

                    const nextZoom = Math.max(
                        MIN_AUTO_FIT_ZOOM,
                        Math.floor((availableHeight / renderedHeight) * 100) / 100
                    );

                    if (nextZoom < 0.99) {
                        scoreZoomElement.style.setProperty("zoom", String(nextZoom));
                    }
                });
            };

            const notifyScoreLoaded = (score: alphaTab.model.Score) => {
                const selected = getSelectedTrack(score, trackIndexRef.current);
                const selectedTrackIndex = selected?.index ?? 0;
                const { events, tempo } = parseAlphaTabScore(score, harmonicaKeyRef.current, selectedTrackIndex, transposeRef.current);
                onScoreLoadedRef.current(events, score, getTracksInfo(score), tempo);
            };

            onAlphaTabEventOf(api.scoreLoaded, (score) => {
                console.log("AlphaTab: Score loaded into API.");
                (window as WindowWithAlphaTabDebug).alphaTabScore = score;
                hideScoreHeaderFooter(score);

                try {
                    if (renderFrameRef.current !== null) {
                        window.cancelAnimationFrame(renderFrameRef.current);
                    }
                    renderFrameRef.current = window.requestAnimationFrame(() => {
                        renderFrameRef.current = null;
                        try {
                            applySelectedTrack(trackIndexRef.current, transposeRef.current);
                        } catch {
                            console.warn("AlphaTab: Failed to apply selected track.");
                        }
                    });
                } catch {
                    console.warn("AlphaTab: Failed to apply selected track.");
                }
                
                notifyScoreLoaded(score);
            });

            onAlphaTabEvent(api.postRenderFinished, () => {
                console.log("AlphaTab: Render finished.");
                scheduleAutoFit();
            });

            onAlphaTabEvent(api.playerReady, () => {
                console.log("AlphaTab: Player ready.");
                onReadyChangeRef.current?.(true);
                if (lastTickRef.current > 0) {
                    api!.tickPosition = lastTickRef.current;
                }
            });

            onAlphaTabEventOf(api.playerPositionChanged, (args) => {
                lastTickRef.current = args.currentTick;
                onTimeUpdateRef.current(args.currentTick);

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
                console.log("AlphaTab: Destroying API instance");
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
                    console.warn("AlphaTab: Destroy failed.");
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
                applyHarmonicaNotationView(currentTrack);
                setTrackTranspositionPitch(currentApi, currentTrack, transpose);
                currentApi.changeTrackSolo([currentTrack], true);
                currentApi.score.tracks.forEach(t => currentApi.changeTrackMute([t], t !== currentTrack));
                currentApi.renderTracks([currentTrack]);
                currentApi.loadMidiForScore();
            } catch {
                console.warn("AlphaTab: Failed to update track render state.");
            }

            const selectedTrackIndex = Math.max(0, currentApi.score.tracks.indexOf(currentTrack));
            const { events, tempo } = parseAlphaTabScore(currentApi.score, harmonicaKey, selectedTrackIndex, transpose);
            const tracksInfo = currentApi.score.tracks.map((t, i) => ({ index: i, name: t.name }));
            onScoreLoadedRef.current(events, currentApi.score, tracksInfo, tempo);
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
