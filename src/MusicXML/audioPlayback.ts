import { Note } from "tonal";
import type { PlaybackNote } from "./types";

export const ensureAudioContext = (audioContext: AudioContext | null) => {
  if (audioContext) return audioContext;

  return new AudioContext();
};

const disconnectAudioNode = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
};

const trackAudioNode = (
  activeAudioNodes: Set<AudioScheduledSourceNode>,
  node: AudioScheduledSourceNode,
  onEnded: () => void
) => {
  activeAudioNodes.add(node);
  node.addEventListener(
    "ended",
    () => {
      activeAudioNodes.delete(node);
      disconnectAudioNode(node);
      onEnded();
    },
    { once: true }
  );
};

export const stopAudioNodes = (nodes: Set<AudioScheduledSourceNode>) => {
  Array.from(nodes).forEach((node) => {
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    disconnectAudioNode(node);
  });
  nodes.clear();
};

export const getAudioOutputLatencyMs = (audioContext: AudioContext | null) => {
  if (!audioContext) return 0;

  const contextWithLatency = audioContext as AudioContext & {
    outputLatency?: number;
  };
  const latencySeconds =
    (audioContext.baseLatency || 0) + (contextWithLatency.outputLatency || 0);

  return Math.max(0, latencySeconds * 1000);
};

export const playPlaybackNotes = (
  audioContext: AudioContext,
  activeAudioNodes: Set<AudioScheduledSourceNode>,
  notes: PlaybackNote[],
  tempoBpm: number
) => {
  notes.forEach((note) => {
    if (!note.shouldPlay) return;

    const frequency = Note.freq(note.name);
    if (!frequency) return;

    const mainOscillator = audioContext.createOscillator();
    const bodyOscillator = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    let endedSourceCount = 0;
    const cleanupSharedAudioNodes = () => {
      endedSourceCount += 1;
      if (endedSourceCount < 2) return;

      disconnectAudioNode(filter);
      disconnectAudioNode(gain);
    };
    const now = audioContext.currentTime;
    const durationMs = Math.max(80, (60000 / tempoBpm) * note.durationBeats);
    const articulationRatio = note.tieStart
      ? 1
      : note.articulation === "staccato"
        ? 0.42
        : note.articulation === "tenuto"
          ? 0.98
          : 0.86;
    const accentBoost = note.articulation === "accent" ? 1.18 : 1;
    const noteSeconds = Math.max(0.08, (durationMs / 1000) * articulationRatio);
    const peakGain = Math.min(0.2, 0.045 * note.velocity * accentBoost);
    const attack = note.tieStop ? 0.004 : 0.018;

    mainOscillator.type = "triangle";
    bodyOscillator.type = "sine";
    mainOscillator.frequency.setValueAtTime(frequency, now);
    bodyOscillator.frequency.setValueAtTime(frequency * 2, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400 + note.velocity * 1800, now);
    filter.Q.setValueAtTime(0.9, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + attack);
    gain.gain.setTargetAtTime(peakGain * 0.72, now + attack, 0.08);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.05, noteSeconds)
    );

    mainOscillator.connect(filter);
    bodyOscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    mainOscillator.start(now);
    bodyOscillator.start(now);
    mainOscillator.stop(now + noteSeconds + 0.02);
    bodyOscillator.stop(now + noteSeconds + 0.02);
    trackAudioNode(activeAudioNodes, mainOscillator, cleanupSharedAudioNodes);
    trackAudioNode(activeAudioNodes, bodyOscillator, cleanupSharedAudioNodes);
  });
};
