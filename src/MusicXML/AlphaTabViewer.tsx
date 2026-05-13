import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import { parseAlphaTabScore } from "./alphaTabParser";
import type { PlaybackEvent } from "./types";

export interface AlphaTabViewerRef {
    playPause: () => void;
    stop: () => void;
    setTempo: (tempo: number) => void;
    unlockAudio: () => void;
    transpose: (interval: number) => void;
    setTickPosition: (tick: number) => void;
}

interface AlphaTabViewerProps {
    fileData: string | Uint8Array;
    harmonicaKey: string;
    trackIndex?: number;
    transpose?: number;
    soundFont?: string;
    selectedPreset?: string;
    onScoreLoaded: (events: PlaybackEvent[], score: alphaTab.model.Score, tracks: {index: number, name: string}[]) => void;
    onTimeUpdate: (currentTimeMs: number) => void;
    onPlaybackFinished: () => void;
}

const AlphaTabViewer = forwardRef<AlphaTabViewerRef, AlphaTabViewerProps>(({ 
    fileData, 
    harmonicaKey,
    trackIndex = 0,
    transpose = 0,
    soundFont = "022_Florestan_Harmonica.sf2",
    selectedPreset = "0:22",
    onScoreLoaded, 
    onTimeUpdate, 
    onPlaybackFinished 
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const alphaTabRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
    const [isReady, setIsReady] = useState(false);
    const lastTickRef = useRef(0);

    useImperativeHandle(ref, () => ({
        unlockAudio: () => {
            console.log("AlphaTab: Force unlocking audio...");
            const api = apiRef.current;
            if (api && api.player) {
                try {
                    const ctx = (api.player as any)._out?.context || (api.player as any)._audioContext;
                    if (ctx && ctx.state === 'suspended') {
                        ctx.resume().then(() => console.log("AlphaTab: Context resumed."));
                    }
                } catch (e) {
                    console.warn("AlphaTab: Unlock error", e);
                }
            }
        },
        playPause: () => {
            const api = apiRef.current;
            const scoreLoaded = !!api?.score;
            if (api && scoreLoaded) {
                console.log("AlphaTab: playPause request. State:", api.playerState);
                try {
                    if (api.playerState === 1) {
                        api.pause();
                    } else {
                        const ctx = (api.player as any)._out?.context || (api.player as any)._audioContext;
                        if (ctx && ctx.state === 'suspended') ctx.resume();
                        api.play();
                    }
                } catch (e) {
                    console.error("AlphaTab: Playback error", e);
                }
            } else {
                console.warn(`AlphaTab: Cannot play. Score Loaded: ${scoreLoaded}, API: ${!!api}`);
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
        transpose: (_interval: number) => {
            console.log("AlphaTab: Transpose handled via props");
        },
        setTickPosition: (tick: number) => {
            if (apiRef.current) {
                apiRef.current.tickPosition = tick;
            }
        }
    }));

    useEffect(() => {
        if (!alphaTabRef.current || !fileData) return;

        let api: alphaTab.AlphaTabApi | null = null;
        setIsReady(false);

        try {
            const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, '') + '/';
            const sfPath = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.2/dist/soundfont/sonivox.sf2";
            
            console.log(`AlphaTab: Initializing API core...`);

            api = new alphaTab.AlphaTabApi(alphaTabRef.current, {
                core: {
                    logLevel: alphaTab.LogLevel.Info,
                    fontDirectory: baseUrl + "font/",
                },
                player: {
                    enablePlayer: true,
                    soundFont: sfPath,
                    scrollElement: containerRef.current,
                    isLooping: false,
                },
                display: {
                    layoutMode: alphaTab.LayoutMode.Horizontal,
                }
            });

            apiRef.current = api;
            (window as any).alphaTabApi = api;

            const safeOn = (obj: any, cb: any) => { if (obj && typeof obj.on === 'function') obj.on(cb); };

            let scoreLoaded = false;
            let sfLoaded = false;

            const checkReady = () => {
                if (scoreLoaded) {
                    setIsReady(true);
                    console.log("AlphaTab: Engine ready.");
                    if (lastTickRef.current > 0 && api?.player) {
                        api.tickPosition = lastTickRef.current;
                    }
                }
            };

            safeOn(api.scoreLoaded, (score: alphaTab.model.Score) => {
                console.log("AlphaTab: Score loaded into API.");
                scoreLoaded = true;
                (window as any).alphaTabScore = score;
                
                score.tracks.forEach(track => {
                    if (track.playbackInfo) {
                        track.playbackInfo.program = 22;
                        track.playbackInfo.bank = 0;
                    }
                    track.staves.forEach(staff => {
                        staff.bars.forEach(bar => {
                            if (bar.voices) {
                                bar.voices.forEach(voice => {
                                    voice.beats.forEach(beat => {
                                        if ((beat as any).automations) {
                                            (beat as any).automations = (beat as any).automations.filter((a: any) => a.type !== 2 && a.type !== 4);
                                        }
                                    });
                                });
                            }
                        });
                    });
                });

                const track = score.tracks[trackIndex] || score.tracks[0];
                if (track) {
                    api?.renderTracks([track]);
                    try {
                        api?.changeTrackSolo([track], true);
                    } catch (e) { }
                }
                
                const events = parseAlphaTabScore(score, harmonicaKey, trackIndex, transpose);
                onScoreLoaded(events, score, score.tracks.map((t, i) => ({ index: i, name: t.name })));
                checkReady();
            });

            safeOn(api.soundFontLoaded, () => {
                console.log("AlphaTab: SoundFont loaded.");
                sfLoaded = true;
                checkReady();
            });

            safeOn(api.playerPositionChanged, (args: any) => {
                if (args.currentTick !== undefined) {
                    lastTickRef.current = args.currentTick;
                    onTimeUpdate(args.currentTick);
                }
            });
            safeOn(api.playerFinished, () => onPlaybackFinished());

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
                try { api.destroy(); } catch (e) { }
                if (apiRef.current === api) {
                    apiRef.current = null;
                    delete (window as any).alphaTabApi;
                }
            }
        };
    }, [fileData, harmonicaKey]);


    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;

        // Apply audio transposition via player property (most stable for GP)
        if (api.player && (api.player as any).masterTransposition !== transpose) {
            console.log(`AlphaTab: Setting audio master transposition to ${transpose}`);
            (api.player as any).masterTransposition = transpose;
        }

        if (api.score) {
            const track = api.score.tracks[trackIndex];
            if (track) {
                api.renderTracks([track]);
                try {
                    api.changeTrackSolo([track], true);
                    api.score.tracks.forEach(t => api.changeTrackMute([t], t !== track));
                } catch (e) { }

                const [bank, program] = selectedPreset.split(":").map(Number);
                if (!isNaN(program)) {
                    api.score.tracks.forEach(t => {
                        if (t.playbackInfo) t.playbackInfo.program = program;
                    });
                }

                const events = parseAlphaTabScore(api.score, harmonicaKey, trackIndex, transpose);
                const tracksInfo = api.score.tracks.map((t, i) => ({ index: i, name: t.name }));
                onScoreLoaded(events, api.score, tracksInfo);
            }
        }
    }, [transpose, trackIndex, selectedPreset]);

    return (
        <div ref={containerRef} className="h-full w-full bg-white overflow-y-hidden overflow-x-auto relative">
            <div ref={alphaTabRef} />
        </div>
    );
});

export default AlphaTabViewer;
