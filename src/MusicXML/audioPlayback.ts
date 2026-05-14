import { Note } from "tonal";
import type { PlaybackNote } from "./types";
import { WorkletSynthesizer } from "spessasynth_lib";
import { musicXmlDebugLogger } from "./debugLogger";

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
  private initGeneration = 0;
  private noteGeneration = 0;
  private readonly noteOffTimers = new Set<TimerId>();

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
    if (audioContext) return audioContext;
    return new AudioContext();
  }

  async initSynthesizer(audioContext: AudioContext, sfName: string = "MS_Basic.sf3") {
    if (this.initPromise && (this.currentSfName === sfName || this.pendingSfName === sfName)) {
      return this.initPromise;
    }

    const generation = this.initGeneration + 1;
    this.initGeneration = generation;
    this.pendingSfName = sfName;

    const assertCurrentGeneration = () => {
      if (generation !== this.initGeneration) {
        throw new Error(`SoundFont load superseded: ${sfName}`);
      }
    };

    this.initPromise = (async () => {
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
        try {
          await audioContext.audioWorklet.addModule(workletUrl);
        } catch {
          this.logger.log("Worklet already loaded or failed to load, continuing...");
        }
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
    this.synth.controllerChange(0, 0, bank);
    this.synth.programChange(0, program);
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

    this.synth?.stopAll();
  }

  getAudioOutputLatencyMs(audioContext: AudioContext | null) {
    if (!audioContext) return 0;

    const contextWithLatency = audioContext as AudioContext & { outputLatency?: number };
    const latencySeconds = (audioContext.baseLatency || 0) + (contextWithLatency.outputLatency || 0);
    return Math.max(0, latencySeconds * 1000);
  }

  playPlaybackNotes(notes: PlaybackNote[], tempoBpm: number) {
    if (!this.synth) {
      this.logger.warn("Synthesizer not initialized yet.");
      return;
    }

    notes.forEach((note) => {
      if (!note.shouldPlay) return;

      const midiNote = Note.midi(note.name);
      if (midiNote === null) return;

      const durationMs = Math.max(80, (60000 / tempoBpm) * note.durationBeats);
      const articulationRatio = note.tieStart
        ? 1
        : note.articulation === "staccato"
          ? 0.42
          : note.articulation === "tenuto"
            ? 0.98
            : 0.86;
      const soundDurationMs = durationMs * articulationRatio;
      const velocity = Math.min(127, Math.max(0, Math.floor(note.velocity * 127)));
      const generation = this.noteGeneration;

      this.synth!.noteOn(0, midiNote, velocity);
      this.synth!.controllerChange(0, 7, 100);

      const timerId = this.setTimeoutFn(() => {
        this.noteOffTimers.delete(timerId);
        if (this.synth && generation === this.noteGeneration) {
          this.synth.noteOff(0, midiNote);
        }
      }, soundDurationMs);
      this.noteOffTimers.add(timerId);
    });
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

export const stopAudioNodes = (nodes?: Set<AudioScheduledSourceNode>) =>
  audioPlaybackService.stopAudioNodes(nodes);

export const getAudioOutputLatencyMs = (audioContext: AudioContext | null) =>
  audioPlaybackService.getAudioOutputLatencyMs(audioContext);

export const playPlaybackNotes = (notes: PlaybackNote[], tempoBpm: number) =>
  audioPlaybackService.playPlaybackNotes(notes, tempoBpm);
