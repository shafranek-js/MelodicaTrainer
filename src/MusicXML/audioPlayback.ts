import { Note } from "tonal";
import type { PlaybackNote } from "./types";
import { WorkletSynthesizer } from "spessasynth_lib";

let synth: WorkletSynthesizer | null = null;
let currentSfName: string | null = null;

export const ensureAudioContext = (audioContext: AudioContext | null) => {
  if (audioContext) return audioContext;
  return new AudioContext();
};

/**
 * Initializes the synthesizer and loads the SoundFont if not already loaded.
 */
export const initSynthesizer = async (audioContext: AudioContext, sfName: string = "MS_Basic.sf3") => {
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
    await audioContext.audioWorklet.addModule(workletUrl);
    
    // Create synthesizer
    synth = new WorkletSynthesizer(audioContext);
    
    // Connect to output
    synth.connect(audioContext.destination);
  } else {
    // If synth exists but we are changing SF, clear old ones
    (synth as any).soundBankManager.soundBankList.forEach((_sb: any, id: number) => {
        (synth as any).soundBankManager.deleteSoundBank(id);
    });
  }

  console.log("Adding soundbank via soundBankManager...");
  await (synth as any).soundBankManager.addSoundBank(sfArrayBuffer);

  // SpessaSynth v4 might still need a moment to index presets
  console.log("Soundbank added, waiting for preset list...");
  let presets: any[] = [];
  for (let i = 0; i < 50; i++) {
    presets = (synth as any).presetList || [];
    if (presets.length > 0) break;
    await new Promise(r => setTimeout(r, 100));
  }

  currentSfName = sfName;
  console.log(`SoundFont ${sfName} loaded. Presets: ${presets.length}`);
  return synth;
};

export const getAvailablePresets = () => {
    if (!synth) return [];
    return ((synth as any).presetList || []).map((p: any) => ({
        bank: p.bank,
        program: p.program,
        name: p.presetName || p.name
    }));
};

export const changeInstrument = (program: number, bank: number = 0) => {
    if (!synth) return;
    console.log(`Changing instrument to ${bank}:${program}`);
    synth.programChange(0, program, bank);
};

export const stopAudioNodes = (_nodes: Set<AudioScheduledSourceNode>) => {
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
  audioContext: AudioContext,
  _activeAudioNodes: Set<AudioScheduledSourceNode>,
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
