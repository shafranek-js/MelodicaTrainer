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

const makeAudioContext = (state: AudioContextState = "running") =>
  ({
    audioWorklet: {
      addModule: vi.fn().mockResolvedValue(undefined),
    },
    destination: {},
    state,
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
  vi.unstubAllGlobals();
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

  it("replaces an AudioContext that has already been closed", () => {
    const replacement = makeAudioContext();
    const AudioContextMock = vi.fn(function AudioContextConstructor() {
      return replacement;
    });
    vi.stubGlobal("AudioContext", AudioContextMock);
    const service = new AudioPlaybackService();

    expect(service.ensureAudioContext(makeAudioContext("closed"))).toBe(replacement);
    expect(AudioContextMock).toHaveBeenCalledOnce();
  });

  it("does not reuse a pending SoundFont load from a different AudioContext", async () => {
    const synth = makeSynth();
    const fetchResolvers: Array<(response: Response) => void> = [];
    const fetchFn = vi.fn(() => new Promise<Response>((resolve) => {
      fetchResolvers.push(resolve);
    }));
    const createSynthesizer = vi.fn(() => synth as never);
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer,
      fetchFn: fetchFn as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
      setTimeoutFn: (callback) => {
        callback();
        return 0 as never;
      },
    });
    const staleContext = makeAudioContext();
    const activeContext = makeAudioContext();

    const staleLoad = service.initSynthesizer(staleContext, "test.sf2");
    const activeLoad = service.initSynthesizer(activeContext, "test.sf2");
    expect(fetchFn).toHaveBeenCalledTimes(2);

    fetchResolvers.forEach((resolve) => resolve({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as Response));

    await expect(staleLoad).rejects.toThrow("SoundFont load superseded");
    await expect(activeLoad).resolves.toBe(synth);
    expect(createSynthesizer).toHaveBeenCalledOnce();
    expect(createSynthesizer).toHaveBeenCalledWith(activeContext);
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

  it("uses isolated channels and applies live accompaniment volume", async () => {
    vi.useFakeTimers();
    const synth = makeSynth();
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer: () => synth as never,
      fetchFn: vi.fn(makeFetchResponse) as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
    });
    await service.initSynthesizer(makeAudioContext(), "test.sf2");

    service.changeInstrument(22, 0);
    service.setAccompanimentVolume(10);
    service.playPlaybackNotes([makeNote()], 120, 1, 2);

    expect(synth.programChange).toHaveBeenCalledWith(0, 22);
    expect(synth.programChange).toHaveBeenCalledWith(2, 22);
    expect(synth.controllerChange).toHaveBeenCalledWith(2, 7, 10);
    expect(synth.noteOn).toHaveBeenCalledWith(2, 60, 101);

    await vi.runOnlyPendingTimersAsync();
    expect(synth.noteOff).toHaveBeenCalledWith(2, 60);
  });

  it("records the synthesized mix and closes notes without stopping live audio", async () => {
    let now = 0;
    const synth = makeSynth();
    const service = new AudioPlaybackService({
      baseUrl: "/",
      createSynthesizer: () => synth as never,
      fetchFn: vi.fn(makeFetchResponse) as unknown as typeof fetch,
      logger: { log: vi.fn(), warn: vi.fn() },
    });
    await service.initSynthesizer(makeAudioContext(), "test.sf2");
    service.changeInstrument(22, 0);
    expect(service.startMidiRecording(() => now)).toBe(true);
    service.noteOn(60, 105);
    now = 180;
    const recording = service.finishMidiRecording();

    expect(recording?.durationMs).toBe(180);
    expect(recording?.events.some((event) =>
      event.kind === "program-change" && event.value === 22)).toBe(true);
    expect(recording?.events.filter((event) => event.kind === "note-on")).toHaveLength(1);
    expect(recording?.events.filter((event) => event.kind === "note-off")).toHaveLength(1);
    expect(synth.noteOff).not.toHaveBeenCalled();
  });
});
