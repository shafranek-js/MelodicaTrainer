import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiRecording } from "./midiRecording";
import {
  downloadRecordingBlob,
  getRecordingFileName,
  renderRecordingMp3,
} from "./recordingExport";

const recording: MidiRecording = {
  durationMs: 200,
  events: [{
    channel: 0,
    kind: "note-on",
    midi: 60,
    order: 0,
    timeMs: 0,
    value: 100,
  }, {
    channel: 0,
    kind: "note-off",
    midi: 60,
    order: 1,
    timeMs: 200,
    value: 0,
  }],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MP3 recording export", () => {
  it("renders MIDI with the selected SoundFont and releases WebMscore", async () => {
    const destroy = vi.fn();
    const saveAudio = vi.fn().mockResolvedValue(new Uint8Array([0x49, 0x44, 0x33, 4]));
    const saveXml = vi.fn().mockResolvedValue("");
    const setSoundFont = vi.fn().mockResolvedValue(undefined);
    const rpc = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue({ destroy, rpc, saveAudio, saveXml, setSoundFont });
    const blob = await renderRecordingMp3(recording, "melodica.sf2", {
      fetchFn: vi.fn().mockResolvedValue({
        arrayBuffer: async () => new ArrayBuffer(4),
        ok: true,
      }) as unknown as typeof fetch,
      loadModule: async () => ({ default: { load } }),
    });

    expect(load).toHaveBeenCalledWith("midi", expect.any(Uint8Array), [], false);
    expect(setSoundFont).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(rpc).toHaveBeenCalledWith(
      "load",
      ["midi", expect.any(Uint8Array), [], true],
      [expect.any(ArrayBuffer)],
    );
    expect(setSoundFont.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      saveAudio.mock.invocationCallOrder[0],
    );
    expect(saveAudio).toHaveBeenCalledWith("mp3");
    expect(destroy).toHaveBeenCalledWith(false);
    expect(blob.type).toBe("audio/mpeg");
  });

  it("creates a stable score-based filename", () => {
    expect(getRecordingFileName(
      "My tune.musicxml",
      new Date("2026-07-19T20:30:40.000Z"),
    )).toBe("My-tune-recording-2026-07-19T20-30-40Z.mp3");
  });

  it("downloads and revokes the object URL", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    downloadRecordingBlob(new Blob(["mp3"]), "take.mp3");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
