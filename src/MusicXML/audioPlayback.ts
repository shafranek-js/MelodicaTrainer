import { Note } from "tonal";
import type { PlaybackNote } from "./types";
import { WorkletSynthesizer } from "spessasynth_lib";
import { musicXmlDebugLogger } from "./debugLogger";
import { ACCOMPANIMENT_CHANNELS } from "./accompaniment";
import { MidiRecordingSession } from "./midiRecording";
import type { MidiRecording } from "./midiRecording";

export type SoundFontPreset = {
  bank: number;
  program: number;
  name: string;
};

type SoundBankManager = {
  soundBankList: { forEach: (callback: (entry: unknown, id: number) => void) => void };
  deleteSoundBank: (id: number) => void;
  addSoundBank: (buffer: ArrayBuffer) => Promise<unknown>;
};

type SynthWithSoundBanks = WorkletSynthesizer & {
  soundBankManager: SoundBankManager;
  presetList?: SoundFontPreset[];
};

type RawPreset = {
  bank?: number;
  program?: number;
  presetName?: string;
  name?: string;
};

type Logger = Pick<Console, "log" | "warn">;
type TimerId = ReturnType<typeof setTimeout>;

const PRIMARY_PLAYBACK_CHANNEL = 0;
const PRIMARY_CHANNEL_VOLUME = 100;
const PLAYBACK_CHANNELS = [PRIMARY_PLAYBACK_CHANNEL, ...ACCOMPANIMENT_CHANNELS];

type AudioPlaybackServiceOptions = {
  baseUrl?: string;
  clearTimeoutFn?: (timerId: TimerId) => void;
  createSynthesizer?: (audioContext: AudioContext) => WorkletSynthesizer;
  fetchFn?: typeof fetch;
  logger?: Logger;
  setTimeoutFn?: (callback: () => void, delayMs: number) => TimerId;
};

export class AudioPlaybackService {
  private synth: WorkletSynthesizer | null = null;
  private currentSfName: string | null = null;
  private pendingSfName: string | null = null;
  private initPromise: Promise<WorkletSynthesizer> | null = null;
  private initAudioContext: AudioContext | null = null;
  private initGeneration = 0;
  private noteGeneration = 0;
  private readonly noteOffTimers = new Set<TimerId>();
  private readonly activeSynthNotes = new Map<
    string,
    { channel: number; count: number; midi: number; velocity: number }
  >();
  private readonly bankByChannel = new Map<number, number>();
  private readonly programByChannel = new Map<number, number>();
  private readonly volumeByChannel = new Map<number, number>();
  private recordingSession: MidiRecordingSession | null = null;

  private readonly baseUrl: string;
  private readonly clearTimeoutFn: (timerId: TimerId) => void;
  private readonly createSynthesizer: (audioContext: AudioContext) => WorkletSynthesizer;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Logger;
  private readonly setTimeoutFn: (callback: () => void, delayMs: number) => TimerId;

  constructor({
    baseUrl = import.meta.env.BASE_URL,
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
    createSynthesizer = (audioContext) => new WorkletSynthesizer(audioContext),
    fetchFn = globalThis.fetch.bind(globalThis),
    logger = musicXmlDebugLogger,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  }: AudioPlaybackServiceOptions = {}) {
    this.baseUrl = baseUrl;
    this.clearTimeoutFn = clearTimeoutFn;
    this.createSynthesizer = createSynthesizer;
    this.fetchFn = fetchFn;
    this.logger = logger;
    this.setTimeoutFn = setTimeoutFn;
  }

  ensureAudioContext(audioContext: AudioContext | null) {
    if (audioContext && audioContext.state !== "closed") return audioContext;
    return new AudioContext();
  }

  async initSynthesizer(audioContext: AudioContext, sfName: string = "MS_Basic.sf3") {
    if (
      this.initPromise &&
      this.initAudioContext === audioContext &&
      (this.currentSfName === sfName || this.pendingSfName === sfName)
    ) {
      return this.initPromise;
    }

    const generation = this.initGeneration + 1;
    this.initGeneration = generation;
    this.pendingSfName = sfName;
    this.initAudioContext = audioContext;

    const assertCurrentGeneration = () => {
      if (generation !== this.initGeneration) {
        throw new Error(`SoundFont load superseded: ${sfName}`);
      }
      if (audioContext.state === "closed") {
        throw new Error("Audio context closed while loading the SoundFont.");
      }
    };

    this.initPromise = (async () => {
      assertCurrentGeneration();
      if (this.synth && this.currentSfName === sfName) return this.synth;

      this.logger.log(`Loading SoundFont: ${sfName}...`);
      const response = await this.fetchFn(`${this.baseUrl}${sfName}`);
      if (!response.ok) throw new Error(`Failed to load SoundFont ${sfName}`);
      assertCurrentGeneration();

      const sfArrayBuffer = await response.arrayBuffer();
      assertCurrentGeneration();

      if (!this.synth) {
        this.logger.log("Loading SpessaSynth Worklet...");
        const workletUrl = `${this.baseUrl}spessasynth_processor.min.js`;
        await audioContext.audioWorklet.addModule(workletUrl);
        assertCurrentGeneration();

        this.synth = this.createSynthesizer(audioContext);
        this.synth.connect(audioContext.destination);
      } else {
        const synthWithBanks = this.synth as SynthWithSoundBanks;
        synthWithBanks.soundBankManager.soundBankList.forEach((_entry, id) => {
          synthWithBanks.soundBankManager.deleteSoundBank(id);
        });
      }
      assertCurrentGeneration();

      this.logger.log("Adding soundbank via soundBankManager...");
      await (this.synth as SynthWithSoundBanks).soundBankManager.addSoundBank(sfArrayBuffer);
      assertCurrentGeneration();

      this.logger.log("Soundbank added, waiting for preset list...");
      let presets: SoundFontPreset[] = [];
      for (let index = 0; index < 50; index += 1) {
        presets = (this.synth as SynthWithSoundBanks).presetList || [];
        if (presets.length > 0) break;
        await new Promise<void>((resolve) => this.setTimeoutFn(() => resolve(), 100));
        assertCurrentGeneration();
      }

      this.currentSfName = sfName;
      this.logger.log(`SoundFont ${sfName} loaded. Presets: ${presets.length}`);
      return this.synth;
    })();

    try {
      return await this.initPromise;
    } finally {
      if (generation === this.initGeneration) {
        this.pendingSfName = null;
        this.initPromise = null;
        this.initAudioContext = null;
      }
    }
  }

  getAvailablePresets(): SoundFontPreset[] {
    if (!this.synth) return [];

    const presetList = ((this.synth as SynthWithSoundBanks).presetList || []) as unknown as RawPreset[];
    return presetList.map((preset) => ({
      bank: preset.bank ?? 0,
      program: preset.program ?? 0,
      name: preset.presetName || preset.name || "Unknown",
    }));
  }

  changeInstrument(program: number, bank: number = 0) {
    if (!this.synth || Number.isNaN(program) || Number.isNaN(bank)) return;

    this.logger.log(`Changing instrument to ${bank}:${program}`);
    PLAYBACK_CHANNELS.forEach((channel) => {
      this.synth!.controllerChange(channel, 0, bank);
      this.synth!.programChange(channel, program);
      this.bankByChannel.set(channel, bank);
      this.programByChannel.set(channel, program);
      this.recordingSession?.recordControlChange(channel, 0, bank);
      this.recordingSession?.recordProgramChange(channel, program);
    });
    this.synth.controllerChange(PRIMARY_PLAYBACK_CHANNEL, 7, PRIMARY_CHANNEL_VOLUME);
    this.volumeByChannel.set(PRIMARY_PLAYBACK_CHANNEL, PRIMARY_CHANNEL_VOLUME);
    this.recordingSession?.recordControlChange(
      PRIMARY_PLAYBACK_CHANNEL,
      7,
      PRIMARY_CHANNEL_VOLUME,
    );
  }

  setAccompanimentVolume(volumePercent: number) {
    if (!this.synth) return;
    const channelVolume = Math.round(
      Math.min(100, Math.max(0, volumePercent)),
    );
    ACCOMPANIMENT_CHANNELS.forEach((channel) => {
      this.synth!.controllerChange(channel, 7, channelVolume);
      this.volumeByChannel.set(channel, channelVolume);
      this.recordingSession?.recordControlChange(channel, 7, channelVolume);
    });
  }

  private synthNoteKey(channel: number, midi: number) {
    return `${channel}:${midi}`;
  }

  private sendNoteOn(channel: number, midi: number, velocity: number) {
    if (!this.synth) return;
    this.synth.noteOn(channel, midi, velocity);
    const key = this.synthNoteKey(channel, midi);
    const active = this.activeSynthNotes.get(key);
    this.activeSynthNotes.set(key, {
      channel,
      count: (active?.count ?? 0) + 1,
      midi,
      velocity,
    });
    this.recordingSession?.recordNoteOn(channel, midi, velocity);
  }

  private sendNoteOff(channel: number, midi: number) {
    if (!this.synth) return;
    this.synth.noteOff(channel, midi);
    const key = this.synthNoteKey(channel, midi);
    const active = this.activeSynthNotes.get(key);
    if (active && active.count > 1) {
      this.activeSynthNotes.set(key, { ...active, count: active.count - 1 });
    } else {
      this.activeSynthNotes.delete(key);
    }
    this.recordingSession?.recordNoteOff(channel, midi);
  }

  private releaseRecordedActiveNotes() {
    this.activeSynthNotes.forEach(({ channel, count, midi }) => {
      for (let index = 0; index < count; index += 1) {
        this.recordingSession?.recordNoteOff(channel, midi);
      }
    });
    this.activeSynthNotes.clear();
  }

  startMidiRecording(now?: () => number) {
    if (this.recordingSession) return false;
    this.recordingSession = new MidiRecordingSession({
      activeNotes: Array.from(this.activeSynthNotes.values()),
      banks: this.bankByChannel,
      programs: this.programByChannel,
      volumes: this.volumeByChannel,
    }, now);
    return true;
  }

  finishMidiRecording(): MidiRecording | null {
    const session = this.recordingSession;
    if (!session) return null;
    this.recordingSession = null;
    return session.finish();
  }

  cancelMidiRecording() {
    this.recordingSession = null;
  }

  stopAudioNodes(nodes?: Set<AudioScheduledSourceNode>) {
    this.noteGeneration += 1;
    this.noteOffTimers.forEach((timerId) => this.clearTimeoutFn(timerId));
    this.noteOffTimers.clear();

    nodes?.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Node may already be stopped.
      }
      node.disconnect();
    });
    nodes?.clear();

    this.releaseRecordedActiveNotes();
    this.synth?.stopAll();
  }

  releaseSynthesizer() {
    this.initGeneration += 1;
    this.pendingSfName = null;
    this.initPromise = null;
    this.initAudioContext = null;
    this.stopAudioNodes();

    try {
      (this.synth as { disconnect?: () => void } | null)?.disconnect?.();
    } catch {
      // Some synth implementations do not expose a stable disconnect lifecycle.
    }

    this.synth = null;
    this.currentSfName = null;
  }

  getAudioOutputLatencyMs(audioContext: AudioContext | null) {
    if (!audioContext) return 0;

    const contextWithLatency = audioContext as AudioContext & { outputLatency?: number };
    const latencySeconds = (audioContext.baseLatency || 0) + (contextWithLatency.outputLatency || 0);
    return Math.max(0, latencySeconds * 1000);
  }

  playPlaybackNotes(
    notes: PlaybackNote[],
    tempoBpm: number,
    tempoScale = 1,
    channel = PRIMARY_PLAYBACK_CHANNEL,
  ) {
    if (!this.synth) {
      this.logger.warn("Synthesizer not initialized yet.");
      return;
    }

    notes.forEach((note) => {
      if (!note.shouldPlay) return;

      const midiNote = Note.midi(note.name);
      if (midiNote === null) return;

      const durationMs = note.durationSeconds === undefined
        ? Math.max(80, (60000 / tempoBpm) * note.durationBeats)
        : Math.max(10, (note.durationSeconds * 1000) / Math.max(0.01, tempoScale));
      const articulationRatio = note.durationSeconds !== undefined || note.tieStart
        ? 1
        : note.articulation === "staccato"
          ? 0.42
          : note.articulation === "tenuto"
            ? 0.98
            : 0.86;
      const soundDurationMs = durationMs * articulationRatio;
      const velocity = Math.min(127, Math.max(0, Math.floor(note.velocity * 127)));
      const generation = this.noteGeneration;

      this.sendNoteOn(channel, midiNote, velocity);

      const timerId = this.setTimeoutFn(() => {
        this.noteOffTimers.delete(timerId);
        if (this.synth && generation === this.noteGeneration) {
          this.sendNoteOff(channel, midiNote);
        }
      }, soundDurationMs);
      this.noteOffTimers.add(timerId);
    });
  }

  noteOn(midiNote: number, velocity = 100, channel = PRIMARY_PLAYBACK_CHANNEL) {
    this.sendNoteOn(channel, midiNote, velocity);
  }

  noteOff(midiNote: number, channel = PRIMARY_PLAYBACK_CHANNEL) {
    this.sendNoteOff(channel, midiNote);
  }
}

export const audioPlaybackService = new AudioPlaybackService();

export const ensureAudioContext = (audioContext: AudioContext | null) =>
  audioPlaybackService.ensureAudioContext(audioContext);

export const initSynthesizer = (audioContext: AudioContext, sfName?: string) =>
  audioPlaybackService.initSynthesizer(audioContext, sfName);

export const getAvailablePresets = () => audioPlaybackService.getAvailablePresets();

export const changeInstrument = (program: number, bank: number = 0) =>
  audioPlaybackService.changeInstrument(program, bank);

export const setAccompanimentVolume = (volumePercent: number) =>
  audioPlaybackService.setAccompanimentVolume(volumePercent);

export const stopAudioNodes = (nodes?: Set<AudioScheduledSourceNode>) =>
  audioPlaybackService.stopAudioNodes(nodes);

export const releaseSynthesizer = () => audioPlaybackService.releaseSynthesizer();

export const getAudioOutputLatencyMs = (audioContext: AudioContext | null) =>
  audioPlaybackService.getAudioOutputLatencyMs(audioContext);

export const playPlaybackNotes = (
  notes: PlaybackNote[],
  tempoBpm: number,
  tempoScale = 1,
  channel = PRIMARY_PLAYBACK_CHANNEL,
) => audioPlaybackService.playPlaybackNotes(notes, tempoBpm, tempoScale, channel);

export const noteOn = (midiNote: number, velocity = 100, channel = PRIMARY_PLAYBACK_CHANNEL) =>
  audioPlaybackService.noteOn(midiNote, velocity, channel);

export const noteOff = (midiNote: number, channel = PRIMARY_PLAYBACK_CHANNEL) =>
  audioPlaybackService.noteOff(midiNote, channel);

export const startMidiRecording = () => audioPlaybackService.startMidiRecording();

export const finishMidiRecording = () => audioPlaybackService.finishMidiRecording();

export const cancelMidiRecording = () => audioPlaybackService.cancelMidiRecording();
