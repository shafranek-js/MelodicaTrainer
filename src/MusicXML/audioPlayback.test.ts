import { describe, expect, it, vi } from "vitest";
import { playPlaybackNotes, stopAudioNodes } from "./audioPlayback";
import type { PlaybackNote } from "./types";

type FakeAudioParam = {
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
};

type FakeAudioNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeScheduledSource = FakeAudioNode & {
  stop: ReturnType<typeof vi.fn>;
};

type FakeOscillator = FakeScheduledSource & {
  addEventListener: ReturnType<typeof vi.fn>;
  dispatchEnded: () => void;
  frequency: FakeAudioParam;
  start: ReturnType<typeof vi.fn>;
  type: OscillatorType;
};

type FakeFilter = FakeAudioNode & {
  frequency: FakeAudioParam;
  Q: FakeAudioParam;
  type: BiquadFilterType;
};

type FakeGain = FakeAudioNode & {
  gain: FakeAudioParam;
};

const makeAudioParam = (): FakeAudioParam => ({
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
});

const makeAudioNode = (): FakeAudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const makePlayableNote = (): PlaybackNote => ({
  name: "C4",
  durationBeats: 1,
  velocity: 0.7,
  articulation: "normal",
  tieStart: false,
  tieStop: false,
  shouldPlay: true,
});

const makeFakeAudioContext = () => {
  const oscillators: FakeOscillator[] = [];
  const filters: FakeFilter[] = [];
  const gains: FakeGain[] = [];

  const createOscillator = (): FakeOscillator => {
    const endedListeners: Array<() => void> = [];
    const oscillator: FakeOscillator = {
      ...makeAudioNode(),
      addEventListener: vi.fn(
        (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type !== "ended") return;

          endedListeners.push(() => {
            if (typeof listener === "function") {
              listener(new Event("ended"));
              return;
            }

            listener.handleEvent(new Event("ended"));
          });
        }
      ),
      dispatchEnded: () => endedListeners.forEach((listener) => listener()),
      frequency: makeAudioParam(),
      start: vi.fn(),
      stop: vi.fn(),
      type: "sine",
    };

    oscillators.push(oscillator);
    return oscillator;
  };

  const context = {
    currentTime: 12,
    destination: makeAudioNode(),
    createBiquadFilter: vi.fn(() => {
      const filter: FakeFilter = {
        ...makeAudioNode(),
        frequency: makeAudioParam(),
        Q: makeAudioParam(),
        type: "lowpass",
      };
      filters.push(filter);
      return filter as unknown as BiquadFilterNode;
    }),
    createGain: vi.fn(() => {
      const gain: FakeGain = {
        ...makeAudioNode(),
        gain: makeAudioParam(),
      };
      gains.push(gain);
      return gain as unknown as GainNode;
    }),
    createOscillator: vi.fn(
      () => createOscillator() as unknown as OscillatorNode
    ),
  } as unknown as AudioContext;

  return { context, filters, gains, oscillators };
};

describe("audio playback helpers", () => {
  it.skip("removes ended source nodes and disconnects the note audio graph", () => {
    // Skipped: We now use SpessaSynth for playback, so activeAudioNodes is not populated by playPlaybackNotes
  });

  it("stops, disconnects, and clears active source nodes", () => {
    const sourceNodes: FakeScheduledSource[] = [
      { ...makeAudioNode(), stop: vi.fn() },
      { ...makeAudioNode(), stop: vi.fn() },
    ];
    const activeAudioNodes = new Set(
      sourceNodes.map((node) => node as unknown as AudioScheduledSourceNode)
    );

    stopAudioNodes(activeAudioNodes);

    expect(activeAudioNodes.size).toBe(0);
    expect(sourceNodes[0].stop).toHaveBeenCalledTimes(1);
    expect(sourceNodes[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sourceNodes[1].stop).toHaveBeenCalledTimes(1);
    expect(sourceNodes[1].disconnect).toHaveBeenCalledTimes(1);
  });
});
