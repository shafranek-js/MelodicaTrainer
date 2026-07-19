import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audioMocks = vi.hoisted(() => ({
  ensureAudioContext: vi.fn(),
  initSynthesizer: vi.fn(),
  noteOff: vi.fn(),
  noteOn: vi.fn(),
  releaseSynthesizer: vi.fn(),
}));

vi.mock("../MusicXML/audioPlayback", () => audioMocks);

import { useInteractiveSynth } from "./useInteractiveSynth";

type InteractiveSynth = ReturnType<typeof useInteractiveSynth>;
let latestSynth: InteractiveSynth | null = null;

const TestComponent = () => {
  latestSynth = useInteractiveSynth({ soundFont: "test.sf2" });
  return null;
};

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("useInteractiveSynth", () => {
  let audioContext: AudioContext;
  let close: ReturnType<typeof vi.fn>;
  let root: Root;

  beforeEach(async () => {
    vi.clearAllMocks();
    close = vi.fn();
    audioContext = {
      close,
      resume: vi.fn().mockResolvedValue(undefined),
      state: "running",
    } as unknown as AudioContext;
    audioMocks.ensureAudioContext.mockImplementation(
      (existing: AudioContext | null) => existing ?? audioContext,
    );
    audioMocks.initSynthesizer.mockResolvedValue({});
    latestSynth = null;
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(TestComponent)));
  });

  it("does not start a note released before SoundFont initialization completes", async () => {
    const pending: { resolve?: () => void } = {};
    audioMocks.initSynthesizer.mockImplementationOnce(
      () => new Promise<void>((resolve) => { pending.resolve = resolve; }),
    );

    act(() => latestSynth?.noteOn(60));
    act(() => latestSynth?.noteOff(60));
    pending.resolve?.();
    await act(flushPromises);

    expect(audioMocks.noteOn).not.toHaveBeenCalled();
    expect(audioMocks.noteOff).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("reuses one AudioContext and releases active notes on unmount", async () => {
    act(() => latestSynth?.noteOn(60));
    await act(flushPromises);
    act(() => latestSynth?.noteOff(60));
    act(() => latestSynth?.noteOn(62));
    await act(flushPromises);

    expect(audioMocks.ensureAudioContext).toHaveBeenNthCalledWith(1, null);
    expect(audioMocks.ensureAudioContext).toHaveBeenNthCalledWith(2, audioContext);
    expect(audioMocks.noteOn).toHaveBeenCalledWith(60, 100);
    expect(audioMocks.noteOff).toHaveBeenCalledWith(60);

    act(() => root.unmount());
    expect(audioMocks.noteOff).toHaveBeenCalledWith(62);
    expect(audioMocks.releaseSynthesizer).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("balances the same pitch held by two input sources", async () => {
    act(() => latestSynth?.noteOn(60));
    act(() => latestSynth?.noteOn(60));
    await act(flushPromises);
    expect(audioMocks.noteOn).toHaveBeenCalledOnce();

    act(() => latestSynth?.noteOff(60));
    expect(audioMocks.noteOff).not.toHaveBeenCalled();
    act(() => latestSynth?.noteOff(60));
    expect(audioMocks.noteOff).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
