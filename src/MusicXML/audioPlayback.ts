import { Note } from "tonal";
import type { PlaybackNote } from "./types";
import { WorkletSynthesizer } from "spessasynth_lib";

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

let synth: WorkletSynthesizer | null = null;
let currentSfName: string | null = null;
let initPromise: Promise<WorkletSynthesizer> | null = null;

export const ensureAudioContext = (audioContext: AudioContext | null) => {
  if (audioContext) return audioContext;
  return new AudioContext();
};

/**
 * Initializes the synthesizer and loads the SoundFont if not already loaded.
 */
export const initSynthesizer = async (audioContext: AudioContext, sfName: string = "MS_Basic.sf3") => {
  // Use a singleton promise to avoid race conditions
  if (initPromise && currentSfName === sfName) return initPromise;

  initPromise = (async () => {
      // If synth exists and soundfont is the same, just return
      if (synth && currentSfName === sfName) return synth;

      console.log(`Loading SoundFont: ${sfName}...`);
      const response = await fetch(`${import.meta.env.BASE_URL}${sfName}`);
      if (!response.ok) throw new Error(`Failed to load SoundFont ${sfName}`);
      
      const sfArrayBuffer = await response.arrayBuffer();
      
      if (!synth) {
        // Load the worklet processor (REQUIRED for SpessaSynth v4+)
        console.log("Loading SpessaSynth Worklet...");
        const workletUrl = `${import.meta.env.BASE_URL}spessasynth_processor.min.js`;
        try {
            await audioContext.audioWorklet.addModule(workletUrl);
        } catch {
            console.log("Worklet already loaded or failed to load, continuing...");
        }
        
        // Create synthesizer
        synth = new WorkletSynthesizer(audioContext);
        
        // Connect to output
        synth.connect(audioContext.destination);
      } else {
        // If synth exists but we are changing SF, clear old ones
        const synthWithBanks = synth as SynthWithSoundBanks;
        synthWithBanks.soundBankManager.soundBankList.forEach((_entry, id) => {
            synthWithBanks.soundBankManager.deleteSoundBank(id);
        });
      }

      console.log("Adding soundbank via soundBankManager...");
      await (synth as SynthWithSoundBanks).soundBankManager.addSoundBank(sfArrayBuffer);

      // SpessaSynth v4 might still need a moment to index presets
      console.log("Soundbank added, waiting for preset list...");
      let presets: SoundFontPreset[] = [];
      for (let i = 0; i < 50; i++) {
        presets = (synth as SynthWithSoundBanks).presetList || [];
        if (presets.length > 0) break;
        await new Promise(r => setTimeout(r, 100));
      }

      currentSfName = sfName;
      console.log(`SoundFont ${sfName} loaded. Presets: ${presets.length}`);
      return synth;
  })();

  return initPromise;
};

export const getAvailablePresets = (): SoundFontPreset[] => {
    if (!synth) return [];
    const presetList = ((synth as SynthWithSoundBanks).presetList || []) as unknown as RawPreset[];
    return presetList.map((p) => ({
        bank: p.bank ?? 0,
        program: p.program ?? 0,
        name: p.presetName || p.name || "Unknown"
    }));
};

export const changeInstrument = (program: number, bank: number = 0) => {
    if (!synth || isNaN(program) || isNaN(bank)) return;
    console.log(`Changing instrument to ${bank}:${program}`);
    synth.controllerChange(0, 0, bank);
    synth.programChange(0, program);
};

export const stopAudioNodes = (nodes?: Set<AudioScheduledSourceNode>) => {
  nodes?.forEach((node) => {
    try {
      node.stop();
    } catch {
      // Node may already be stopped.
    }
    node.disconnect();
  });
  nodes?.clear();

  // SpessaSynth handles its own nodes, we tell it to stop all notes
  if (synth) {
    synth.stopAll();
  }
};

export const getAudioOutputLatencyMs = (audioContext: AudioContext | null) => {
  if (!audioContext) return 0;
  const contextWithLatency = audioContext as AudioContext & { outputLatency?: number };
  const latencySeconds = (audioContext.baseLatency || 0) + (contextWithLatency.outputLatency || 0);
  return Math.max(0, latencySeconds * 1000);
};

export const playPlaybackNotes = (
  notes: PlaybackNote[],
  tempoBpm: number
) => {
  if (!synth) {
    console.warn("Synthesizer not initialized yet.");
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

    // SpessaSynth play note
    // noteOn(channel, midiNote, velocity)
    synth!.noteOn(0, midiNote, velocity);

    // Ensure channel volume is up (GM default is usually fine, but let's be safe)
    // Channel Message: 7 is Main Volume
    synth!.controllerChange(0, 7, 100);

    // Schedule noteOff
    setTimeout(() => {
        if (synth) {
            synth.noteOff(0, midiNote);
        }
    }, soundDurationMs);
  });
};
