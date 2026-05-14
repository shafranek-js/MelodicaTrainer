import * as alphaTab from "@coderline/alphatab";
import { applyHarmonicaNotationView } from "./alphaTabSettings";

type AlphaTabApiWithScore = alphaTab.AlphaTabApi & {
  score: alphaTab.model.Score;
};

type HeaderFooterStyle = {
  isVisible?: boolean;
};

export type TrackInfo = {
  index: number;
  name: string;
};

export const getSelectedTrack = (
  score: alphaTab.model.Score,
  selectedTrackIndex: number
) => {
  const track = score.tracks[selectedTrackIndex] || score.tracks[0];
  if (!track) return null;

  return {
    track,
    index: Math.max(0, score.tracks.indexOf(track)),
  };
};

export const getTracksInfo = (score: alphaTab.model.Score): TrackInfo[] =>
  score.tracks.map((track, index) => ({ index, name: track.name }));

export const hideScoreHeaderFooter = (score: alphaTab.model.Score) => {
  score.style?.headerAndFooter?.forEach((style: HeaderFooterStyle) => {
    style.isVisible = false;
  });
};

export const setTrackTranspositionPitch = (
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

export const applySelectedTrackRenderState = (
  api: alphaTab.AlphaTabApi | null,
  selectedTrackIndex: number,
  semitones: number
) => {
  if (!api?.score) return null;

  const currentApi = api as AlphaTabApiWithScore;
  const selection = getSelectedTrack(currentApi.score, selectedTrackIndex);
  if (!selection) return null;

  const { track } = selection;
  applyHarmonicaNotationView(track);
  setTrackTranspositionPitch(currentApi, track, semitones);
  currentApi.changeTrackSolo([track], true);
  currentApi.score.tracks.forEach((candidate) =>
    currentApi.changeTrackMute([candidate], candidate !== track)
  );
  currentApi.renderTracks([track]);
  currentApi.loadMidiForScore();

  return selection;
};
