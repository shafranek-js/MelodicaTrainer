import { Note } from "tonal";
import { createPlaybackTimeline } from "./playbackTimeline";
import type { PlaybackEvent } from "./types";

export type AccompanimentTrack = {
  events: PlaybackEvent[];
  id: string;
  label: string;
};

export type ScheduledAccompanimentEvent = {
  channel: number;
  event: PlaybackEvent;
  startMs: number;
  trackId: string;
};

export const ACCOMPANIMENT_CHANNELS = [
  1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15,
] as const;

const cloneRestEvent = (event: PlaybackEvent): PlaybackEvent => ({
  ...event,
  notes: [],
  tabs: [],
});

/**
 * MusicXML and GP add one synthetic count-in rest to the selected practice
 * stream. Background streams are parsed without that rest so their source
 * positions remain intact, then receive the exact same prefix here.
 */
export const alignAccompanimentLeadIn = (
  primaryEvents: PlaybackEvent[],
  primaryEventsWithoutLeadIn: PlaybackEvent[],
  tracks: AccompanimentTrack[],
): AccompanimentTrack[] => {
  const addedEventCount = primaryEvents.length - primaryEventsWithoutLeadIn.length;
  if (addedEventCount !== 1 || primaryEvents[0]?.notes.length !== 0) {
    return tracks;
  }

  const leadIn = cloneRestEvent(primaryEvents[0]);
  return tracks.map((track) => ({
    ...track,
    events: [cloneRestEvent(leadIn), ...track.events],
  }));
};

export const transposePlaybackEvents = (
  events: PlaybackEvent[],
  semitones: number,
): PlaybackEvent[] => {
  if (semitones === 0) return events;

  return events.map((event) => ({
    ...event,
    notes: event.notes.flatMap((note) => {
      const midi = Note.midi(note.name);
      if (midi === null) return [];
      const transposedMidi = midi + semitones;
      if (transposedMidi < 0 || transposedMidi > 127) return [];
      return [{ ...note, name: Note.fromMidi(transposedMidi) }];
    }),
  }));
};

export const buildAccompanimentSchedule = (
  tracks: AccompanimentTrack[],
): ScheduledAccompanimentEvent[] => tracks
  .flatMap((track, trackIndex) => {
    const channel = ACCOMPANIMENT_CHANNELS[
      Math.min(trackIndex, ACCOMPANIMENT_CHANNELS.length - 1)
    ];
    const timeline = createPlaybackTimeline(track.events, 1);
    return track.events.map((event, eventIndex) => ({
      channel,
      event,
      startMs: timeline[eventIndex]?.startMs ?? 0,
      trackId: track.id,
    }));
  })
  .filter(({ event }) => event.notes.length > 0)
  .sort((left, right) => left.startMs - right.startMs || left.channel - right.channel);

export const hasAccompanimentChannelOverflow = (trackCount: number) =>
  trackCount > ACCOMPANIMENT_CHANNELS.length;

export const sanitizeAccompanimentVolume = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(0, value)))
    : undefined;
