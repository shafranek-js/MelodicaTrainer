import { describe, expect, it, vi } from "vitest";
import {
  applySelectedTrackRenderState,
  getSelectedTrack,
  getTracksInfo,
  hideScoreHeaderFooter,
  setTrackTranspositionPitch,
} from "./alphaTabTrack";
import type * as alphaTab from "@coderline/alphatab";

type MockTrack = {
  name: string;
  staves: Array<{
    showStandardNotation?: boolean;
    showTablature?: boolean;
    standardNotationLineCount?: number;
  }>;
};

const makeTrack = (name: string): MockTrack => ({
  name,
  staves: [{}],
});

const makeScore = (tracks: MockTrack[]) =>
  ({
    tracks,
    style: {
      headerAndFooter: [{ isVisible: true }, { isVisible: true }],
    },
  }) as unknown as alphaTab.model.Score;

const makeApi = (score: alphaTab.model.Score) =>
  ({
    score,
    settings: {
      notation: {
        transpositionPitches: [],
      },
    },
    changeTrackMute: vi.fn(),
    changeTrackSolo: vi.fn(),
    renderTracks: vi.fn(),
    loadMidiForScore: vi.fn(),
  }) as unknown as alphaTab.AlphaTabApi;

describe("alphaTab track helpers", () => {
  it("selects requested track or falls back to first track", () => {
    const tracks = [makeTrack("A"), makeTrack("B")];
    const score = makeScore(tracks);

    expect(getSelectedTrack(score, 1)?.track).toBe(tracks[1]);
    expect(getSelectedTrack(score, 99)?.track).toBe(tracks[0]);
  });

  it("maps score tracks to UI track info", () => {
    expect(getTracksInfo(makeScore([makeTrack("A"), makeTrack("B")]))).toEqual([
      { index: 0, name: "A" },
      { index: 1, name: "B" },
    ]);
  });

  it("hides score header and footer styles", () => {
    const score = makeScore([makeTrack("A")]);

    hideScoreHeaderFooter(score);

    const headerAndFooter = score.style?.headerAndFooter as unknown as Array<{ isVisible?: boolean }>;
    expect(headerAndFooter.map((style) => style.isVisible)).toEqual([false, false]);
  });

  it("sets transposition pitch at selected track index", () => {
    const tracks = [makeTrack("A"), makeTrack("B")];
    const score = makeScore(tracks);
    const api = makeApi(score);

    setTrackTranspositionPitch(api, tracks[1] as unknown as alphaTab.model.Track, 7);

    expect(api.settings.notation.transpositionPitches).toEqual([0, 7]);
  });

  it("applies harmonica notation and renders only selected track", () => {
    const tracks = [makeTrack("A"), makeTrack("B")];
    const score = makeScore(tracks);
    const api = makeApi(score);

    const selection = applySelectedTrackRenderState(api, 1, -2);

    expect(selection?.track).toBe(tracks[1]);
    expect(tracks[1].staves[0]).toMatchObject({
      showStandardNotation: true,
      showTablature: false,
      standardNotationLineCount: 5,
    });
    expect(api.changeTrackSolo).toHaveBeenCalledWith([tracks[1]], true);
    expect(api.changeTrackMute).toHaveBeenCalledWith([tracks[0]], true);
    expect(api.changeTrackMute).toHaveBeenCalledWith([tracks[1]], false);
    expect(api.renderTracks).toHaveBeenCalledWith([tracks[1]]);
    expect(api.loadMidiForScore).toHaveBeenCalledTimes(1);
  });
});
