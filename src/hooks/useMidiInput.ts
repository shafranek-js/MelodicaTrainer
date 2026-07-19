import { useEffect, useRef, useState } from "react";

export type MidiAccessState = "denied" | "ready" | "requesting" | "unsupported";

type UseMidiInputOptions = {
  onNoteOff?: (midi: number) => void;
  onNoteOn?: (midi: number, velocity: number) => void;
};

export type MidiInputState = {
  accessState: MidiAccessState;
  activeNotes: ReadonlySet<number>;
  connectedInputCount: number;
  error: string | null;
};

const hasWebMidi = () =>
  typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

export const useMidiInput = ({
  onNoteOff,
  onNoteOn,
}: UseMidiInputOptions = {}): MidiInputState => {
  const [activeNotes, setActiveNotes] = useState<ReadonlySet<number>>(() => new Set());
  const [accessState, setAccessState] = useState<MidiAccessState>(() =>
    hasWebMidi() ? "requesting" : "unsupported",
  );
  const [connectedInputCount, setConnectedInputCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onNoteOffRef = useRef(onNoteOff);
  const onNoteOnRef = useRef(onNoteOn);

  useEffect(() => {
    onNoteOffRef.current = onNoteOff;
    onNoteOnRef.current = onNoteOn;
  }, [onNoteOff, onNoteOn]);

  useEffect(() => {
    if (!hasWebMidi()) {
      setAccessState("unsupported");
      return;
    }

    let disposed = false;
    let midiAccess: MIDIAccess | null = null;
    const boundInputs = new Map<string, MIDIInput>();
    const inputNotes = new Map<string, Map<string, number>>();
    const noteCounts = new Map<number, number>();

    const publishActiveNotes = () => {
      if (!disposed) {
        setActiveNotes(new Set(noteCounts.keys()));
      }
    };

    const releaseMidi = (midi: number) => {
      const nextCount = (noteCounts.get(midi) ?? 0) - 1;
      if (nextCount <= 0) {
        noteCounts.delete(midi);
        onNoteOffRef.current?.(midi);
      } else {
        noteCounts.set(midi, nextCount);
      }
    };

    const releaseInput = (inputId: string) => {
      const heldNotes = inputNotes.get(inputId);
      heldNotes?.forEach((midi) => releaseMidi(midi));
      inputNotes.delete(inputId);
    };

    const handleMidiMessage = (inputId: string, event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data) return;
      const status = data[0];
      const midi = data[1];
      const velocity = data[2] ?? 0;
      if (status === undefined || midi === undefined) return;

      const command = status & 0xf0;
      const channel = status & 0x0f;
      const noteKey = `${channel}:${midi}`;
      const heldNotes = inputNotes.get(inputId) ?? new Map<string, number>();
      inputNotes.set(inputId, heldNotes);

      if (command === 0x90 && velocity > 0) {
        if (heldNotes.has(noteKey)) return;
        heldNotes.set(noteKey, midi);
        const previousCount = noteCounts.get(midi) ?? 0;
        noteCounts.set(midi, previousCount + 1);
        if (previousCount === 0) {
          onNoteOnRef.current?.(midi, velocity);
        }
        publishActiveNotes();
        return;
      }

      if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        if (!heldNotes.delete(noteKey)) return;
        releaseMidi(midi);
        publishActiveNotes();
      }
    };

    const syncInputs = (access: MIDIAccess) => {
      const connectedInputs = new Map(
        Array.from(access.inputs.values())
          .filter((input) => input.state !== "disconnected")
          .map((input) => [input.id, input]),
      );

      boundInputs.forEach((input, inputId) => {
        if (connectedInputs.has(inputId)) return;
        input.onmidimessage = null;
        boundInputs.delete(inputId);
        releaseInput(inputId);
      });

      connectedInputs.forEach((input, inputId) => {
        const previousInput = boundInputs.get(inputId);
        if (previousInput === input) return;
        if (previousInput) {
          previousInput.onmidimessage = null;
          releaseInput(inputId);
        }
        input.onmidimessage = (event) => handleMidiMessage(inputId, event);
        boundInputs.set(inputId, input);
      });

      if (!disposed) {
        setConnectedInputCount(connectedInputs.size);
        publishActiveNotes();
      }
    };

    setAccessState("requesting");
    setError(null);
    void navigator.requestMIDIAccess()
      .then((access) => {
        if (disposed) return;
        midiAccess = access;
        syncInputs(access);
        access.onstatechange = () => syncInputs(access);
        setAccessState("ready");
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setAccessState("denied");
        setError(cause instanceof Error ? cause.message : "Could not access MIDI devices.");
      });

    return () => {
      disposed = true;
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
      boundInputs.forEach((input, inputId) => {
        input.onmidimessage = null;
        releaseInput(inputId);
      });
      boundInputs.clear();
    };
  }, []);

  return {
    accessState,
    activeNotes,
    connectedInputCount,
    error,
  };
};
