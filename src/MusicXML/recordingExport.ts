import { encodeMidiRecording, hasRecordedNotes } from "./midiRecording";
import type { MidiRecording } from "./midiRecording";
import { loadWebMscoreModule } from "./webMscore";
import type { WebMscoreModule, WebMscoreScore } from "./webMscore";

type RecordingExportDependencies = {
  fetchFn?: typeof fetch;
  loadModule?: () => Promise<WebMscoreModule>;
};

const getPublicAssetUrl = (path: string) => {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
};

export const getRecordingFileName = (
  scoreFileName: string | null,
  date = new Date(),
) => {
  const baseName = (scoreFileName ?? "melody")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "melody";
  const timestamp = date.toISOString().replace(/[:]/g, "-").replace(/\.\d{3}Z$/, "Z");
  return `${baseName}-recording-${timestamp}.mp3`;
};

export const renderRecordingMp3 = async (
  recording: MidiRecording,
  soundFont: string,
  dependencies: RecordingExportDependencies = {},
) => {
  if (!hasRecordedNotes(recording)) {
    throw new Error("Nothing was recorded.");
  }

  const module = await (dependencies.loadModule ?? loadWebMscoreModule)();
  const response = await (dependencies.fetchFn ?? fetch)(getPublicAssetUrl(soundFont));
  if (!response.ok) throw new Error(`Failed to load SoundFont ${soundFont}.`);

  let score: WebMscoreScore | null = null;
  try {
    const midi = encodeMidiRecording(recording);
    score = await module.default.load(
      "midi",
      midi.slice(),
      [],
      false,
    );
    await score.setSoundFont(new Uint8Array(await response.arrayBuffer()));

    // WebMscore creates playback tracks while loading the score. For MIDI
    // imports that happens before setSoundFont(), leaving otherwise valid notes
    // connected to silent synth tracks. Reload inside the same worker after the
    // SoundFont is registered so MuseScore resolves audible instruments.
    await score.rpc(
      "load",
      ["midi", midi, [], true],
      [midi.buffer],
    );

    const mp3 = await score.saveAudio("mp3");
    if (!(mp3 instanceof Uint8Array) || mp3.byteLength === 0) {
      throw new Error("The MP3 encoder returned an empty file.");
    }
    return new Blob([mp3], { type: "audio/mpeg" });
  } finally {
    try {
      score?.destroy(false);
    } catch (error) {
      console.warn("Could not release the MP3 export engine.", error);
    }
  }
};

export const downloadRecordingBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
