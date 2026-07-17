import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlaybackService, stopAudioNodes } from "./audioPlayback";
import type { PlaybackNote } from "./types";

type FakeAudioNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeScheduledSource = FakeAudioNode & {
  stop: ReturnType<typeof vi.fn>;
};

const makeAudioNode = (): FakeAudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const makeNote = (overrides: Partial<PlaybackNote> = {}): PlaybackNote => ({
  name: "C4",
  durationBeats: 1,
  velocity: 0.8,
  articulation: "normal",
  tieStart: false,
  tieStop: false,
  shouldPlay: true,
  ...overrides,
});

const makeAudioContext = () =>
  ({
    audioWorklet: {
      addModule: vi.fn().mockResolvedValue(undefined),
    },
    destination: {},
  }) as unknown as AudioContext;

const makeFetchResponse = () =>
  Promise.resolve({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  } as unknown as Response);

const makeSynth = () => ({
  connect: vi.fn(),
  controllerChange: vi.fn(),
  noteOff: vi.fn(),
  noteOn: vi.fn(),
  programChange: vi.fn(),
  stopAll: vi.fn(),
  presetList: [{ bank: 0, program: 22, name: "Harmonica" }],
  soundBankManager: {
    addSoundBank: vi.fn().mockResolvedValue(undefined),
    deleteSoundBank: vi.fn(),
    soundBankList: new Map(),
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("audio playback helpers", () => {
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

  it("loads a synthesizer through the service and exposes presets", async () => {
    const synth = makeSynth();
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer: () => synth as never,
      fetchFn: vi.fn(makeFetchResponse) as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
      setTimeoutFn: (callback) => {
        callback();
        return 0 as never;
      },
    });

    await service.initSynthesizer(makeAudioContext(), "test.sf2");

    expect(synth.connect).toHaveBeenCalledTimes(1);
    expect(synth.soundBankManager.addSoundBank).toHaveBeenCalledTimes(1);
    expect(service.getAvailablePresets()).toEqual([
      { bank: 0, program: 22, name: "Harmonica" },
    ]);
  });

  it("cancels pending noteOff timers when playback stops", async () => {
    vi.useFakeTimers();
    const synth = makeSynth();
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer: () => synth as never,
      fetchFn: vi.fn(makeFetchResponse) as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
    });
    await service.initSynthesizer(makeAudioContext(), "test.sf2");

    service.playPlaybackNotes([makeNote()], 120);
    service.stopAudioNodes();
    vi.runOnlyPendingTimers();

    expect(synth.noteOn).toHaveBeenCalledTimes(1);
    expect(synth.stopAll).toHaveBeenCalledTimes(1);
    expect(synth.noteOff).not.toHaveBeenCalled();
  });

  it("uses exact MIDI note length and global tempo scaling", async () => {
    const delays: number[] = [];
    const synth = makeSynth();
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer: () => synth as never,
      fetchFn: vi.fn(makeFetchResponse) as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
      setTimeoutFn: (_callback, delayMs) => {
        delays.push(delayMs);
        return 1 as never;
      },
    });
    await service.initSynthesizer(makeAudioContext(), "test.sf2");

    service.playPlaybackNotes(
      [makeNote({ durationSeconds: 0.5 })],
      120,
      2,
    );

    expect(delays).toEqual([250]);
  });
});
