import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  ensureAudioContext,
  initSynthesizer,
  noteOff as synthNoteOff,
  noteOn as synthNoteOn,
  releaseSynthesizer,
} from "../MusicXML/audioPlayback";

type UseInteractiveSynthOptions = {
  audioContextRef?: MutableRefObject<AudioContext | null>;
  soundFont: string;
};

export const useInteractiveSynth = ({
  audioContextRef: providedAudioContextRef,
  soundFont,
}: UseInteractiveSynthOptions) => {
  const ownedAudioContextRef = useRef<AudioContext | null>(null);
  const audioContextRef = providedAudioContextRef ?? ownedAudioContextRef;
  const ownsAudioContext = providedAudioContextRef === undefined;
  const heldNoteCountsRef = useRef(new Map<number, number>());
  const startedNotesRef = useRef(new Set<number>());
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const stopAllInteractiveNotes = useCallback(() => {
    generationRef.current += 1;
    heldNoteCountsRef.current.clear();
    startedNotesRef.current.forEach((midi) => synthNoteOff(midi));
    startedNotesRef.current.clear();
  }, []);

  const noteOn = useCallback((midi: number, velocity = 100) => {
    const previousCount = heldNoteCountsRef.current.get(midi) ?? 0;
    heldNoteCountsRef.current.set(midi, previousCount + 1);
    if (previousCount > 0) return;

    const generation = generationRef.current;
    const startNote = async () => {
      const context = ensureAudioContext(audioContextRef.current);
      audioContextRef.current = context;
      if (context.state === "suspended") {
        await context.resume();
      }
      await initSynthesizer(context, soundFont);

      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        !heldNoteCountsRef.current.has(midi) ||
        startedNotesRef.current.has(midi)
      ) {
        return;
      }

      synthNoteOn(midi, velocity);
      startedNotesRef.current.add(midi);
      setError(null);
    };

    void startNote().catch((cause: unknown) => {
      if (!mountedRef.current || generation !== generationRef.current) return;
      heldNoteCountsRef.current.delete(midi);
      setError(cause instanceof Error ? cause.message : "Could not start instrument audio.");
    });
  }, [audioContextRef, soundFont]);

  const noteOff = useCallback((midi: number) => {
    const nextCount = (heldNoteCountsRef.current.get(midi) ?? 0) - 1;
    if (nextCount > 0) {
      heldNoteCountsRef.current.set(midi, nextCount);
      return;
    }

    heldNoteCountsRef.current.delete(midi);
    if (startedNotesRef.current.delete(midi)) {
      synthNoteOff(midi);
    }
  }, []);

  useEffect(() => {
    stopAllInteractiveNotes();
  }, [soundFont, stopAllInteractiveNotes]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAllInteractiveNotes();
      if (ownsAudioContext) {
        releaseSynthesizer();
        void ownedAudioContextRef.current?.close();
        ownedAudioContextRef.current = null;
      }
    };
  }, [ownsAudioContext, stopAllInteractiveNotes]);

  return {
    error,
    noteOff,
    noteOn,
    stopAllInteractiveNotes,
  };
};
