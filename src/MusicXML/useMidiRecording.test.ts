import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiRecording } from "./midiRecording";

const audioMocks = vi.hoisted(() => ({
  finishMidiRecording: vi.fn(),
  startMidiRecording: vi.fn(() => true),
}));
const exportMocks = vi.hoisted(() => ({
  downloadRecordingBlob: vi.fn(),
  getRecordingFileName: vi.fn(() => "take.mp3"),
  renderRecordingMp3: vi.fn(async () => new Blob(["mp3"], { type: "audio/mpeg" })),
}));

vi.mock("./audioPlayback", () => audioMocks);
vi.mock("./recordingExport", () => exportMocks);

import { useMidiRecording } from "./useMidiRecording";

const recordedNote: MidiRecording = {
  durationMs: 200,
  events: [{
    channel: 0,
    kind: "note-on",
    midi: 60,
    order: 0,
    timeMs: 0,
    value: 100,
  }],
};

describe("useMidiRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioMocks.startMidiRecording.mockReturnValue(true);
  });

  it("starts independently and exports an MP3 when stopped", async () => {
    audioMocks.finishMidiRecording.mockReturnValue(recordedNote);
    const container = document.createElement("div");
    const root = createRoot(container);
    let result!: ReturnType<typeof useMidiRecording>;
    const Probe = () => {
      result = useMidiRecording({ fileName: "Song.mid", soundFont: "melodica.sf2" });
      return null;
    };
    await act(async () => root.render(createElement(Probe)));
    act(() => result.toggleRecording());
    expect(result.recordingState).toBe("recording");
    await act(async () => {
      result.toggleRecording();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(exportMocks.renderRecordingMp3).toHaveBeenCalledWith(
      recordedNote,
      "melodica.sf2",
    );
    expect(exportMocks.downloadRecordingBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "take.mp3",
    );
    expect(result.recordingState).toBe("idle");
    act(() => root.unmount());
  });

  it("reports an empty take without invoking the encoder", async () => {
    audioMocks.finishMidiRecording.mockReturnValue({ durationMs: 100, events: [] });
    const container = document.createElement("div");
    const root = createRoot(container);
    let result!: ReturnType<typeof useMidiRecording>;
    const Probe = () => {
      result = useMidiRecording({ fileName: null, soundFont: "melodica.sf2" });
      return null;
    };
    await act(async () => root.render(createElement(Probe)));
    act(() => result.toggleRecording());
    act(() => result.toggleRecording());
    expect(result.recordingState).toBe("error");
    expect(result.recordingError).toBe("Nothing was recorded.");
    expect(exportMocks.renderRecordingMp3).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
