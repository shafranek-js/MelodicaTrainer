import { useState, useMemo } from "react";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import {
  harmonicaKeys,
  generateLayout,
  freqToNoteAndCents,
  getLayoutMidiNumbers,
} from "../utils/utils";
import type {
  TonalNote,
} from "../utils/utils";

const baseKey = "C4";

function Harmonica() {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [key, setKey] = useState(baseKey);
  const layout = useMemo(() => generateLayout(key), [key]);
  const allowedMidiNumbers = useMemo(
    () => new Set(getLayoutMidiNumbers(layout)),
    [layout]
  );
  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });

  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);

  const isNoteActive = (note: TonalNote | null) => {
    if (!note || !detectedNote) return false;
    return Note.midi(detectedNote.note) === Note.midi(note.name);
  };

  const getTranslatedNote = (note: TonalNote | null) => {
    if (!note) return "";
    const simplifiedPitchClass = Note.simplify(Note.pitchClass(note.name));
    return t(simplifiedPitchClass);
  };

  const renderHole = (holeIndex: number) => {
    const holeNumber = holeIndex + 1;
    const blowNote = layout.blow[holeIndex];
    const drawNote = layout.draw[holeIndex];
    
    // Bends / Overblows
    const blowBend1 = layout.HalfStepBlowBend[holeIndex];
    const blowBend2 = layout.wholeStepBlowBend[holeIndex];
    
    const drawBend1 = layout.halfStepDrawBendOverdraw[holeIndex];
    const drawBend2 = layout.wholeStepDrawBend[holeIndex];
    const drawBend3 = layout.oneAndHalfStepDrawBend[holeIndex];

    const isHoleActiveBlow = isNoteActive(blowNote) || isNoteActive(blowBend1) || isNoteActive(blowBend2);
    const isHoleActiveDraw = isNoteActive(drawNote) || isNoteActive(drawBend1) || isNoteActive(drawBend2) || isNoteActive(drawBend3);

    return (
      <div key={holeNumber} className="flex flex-col items-center gap-1">
        {/* Blow Bends Area */}
        <div className="flex flex-col-reverse h-12 justify-start items-center gap-0.5">
          {blowBend2 && (
            <div className={`bend-note ${isNoteActive(blowBend2) ? 'active' : ''}`}>
              {getTranslatedNote(blowBend2)}
            </div>
          )}
          {blowBend1 && (
            <div className={`bend-note ${isNoteActive(blowBend1) ? 'active' : ''}`}>
              {getTranslatedNote(blowBend1)}
            </div>
          )}
        </div>

        {/* Main Hole */}
        <div className={`harmonica-hole w-full aspect-square sm:aspect-auto sm:h-24 min-w-[3.5rem] ${isHoleActiveBlow ? 'active-blow' : ''} ${isHoleActiveDraw ? 'active-draw' : ''}`}>
            {/* Blow Note */}
            <div className={`note-label mb-auto pt-1 ${isNoteActive(blowNote) ? 'text-blue-400 scale-110' : 'text-blue-200 opacity-60'}`}>
                {getTranslatedNote(blowNote)}
            </div>
            
            {/* Hole Number */}
            <div className="text-gray-500 text-[10px] font-bold select-none py-1">
                {holeNumber}
            </div>

            {/* Draw Note */}
            <div className={`note-label mt-auto pb-1 ${isNoteActive(drawNote) ? 'text-red-400 scale-110' : 'text-red-200 opacity-60'}`}>
                {getTranslatedNote(drawNote)}
            </div>
        </div>

        {/* Draw Bends Area */}
        <div className="flex flex-col h-20 justify-start items-center gap-0.5">
          {drawBend1 && (
            <div className={`bend-note ${isNoteActive(drawBend1) ? 'active' : ''}`}>
              {getTranslatedNote(drawBend1)}
            </div>
          )}
          {drawBend2 && (
            <div className={`bend-note ${isNoteActive(drawBend2) ? 'active' : ''}`}>
              {getTranslatedNote(drawBend2)}
            </div>
          )}
          {drawBend3 && (
            <div className={`bend-note ${isNoteActive(drawBend3) ? 'active' : ''}`}>
              {getTranslatedNote(drawBend3)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-950 p-4 text-white sm:p-8">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
                <h1 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight text-white">
                    HarpVisualizer<span className="text-emerald-500">.</span>
                </h1>
                <p className="text-gray-400 font-medium">Professional Diatonic Harmonica Pitch Monitor</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-4 rounded-xl flex items-center gap-4">
                <div>
                    <label htmlFor="key-select" className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                        Harmonica Key
                    </label>
                    <select
                        id="key-select"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                        {harmonicaKeys.map((k) => (
                        <option key={k.value} value={k.value}>
                            {t(k.label)}
                        </option>
                        ))}
                    </select>
                </div>
                
                <div className="h-10 w-px bg-gray-800 mx-2" />

                <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Detection</span>
                    <button
                        type="button"
                        onClick={() => setIsListening(!isListening)}
                        className={`rounded-lg px-4 py-1.5 font-bold text-xs transition-all flex items-center gap-2 ${
                            isListening 
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50" 
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
                        {isListening ? "STOP" : "START"}
                    </button>
                </div>
            </div>
        </div>

        {/* Real-time Data Display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-inner group transition-all hover:border-gray-700">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-emerald-500 transition-colors">Frequency</span>
                <div className="text-3xl font-mono font-bold text-white mt-1">
                    {pitch ? `${Number(pitch).toFixed(1)}` : "---"} <span className="text-sm text-gray-600">Hz</span>
                </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-inner group transition-all hover:border-gray-700">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-emerald-500 transition-colors">Cents Offset</span>
                <div className="text-3xl font-mono font-bold text-white mt-1">
                    {detectedNote ? `${detectedNote.cents > 0 ? '+' : ''}${detectedNote.cents.toFixed(1)}` : "0.0"} <span className="text-sm text-gray-600">¢</span>
                </div>
                <div className="w-full bg-gray-800 h-1 mt-3 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ${Math.abs(detectedNote?.cents || 0) < 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ 
                            width: `${Math.abs(detectedNote?.cents || 0) * 2}%`,
                            marginLeft: detectedNote?.cents && detectedNote.cents < 0 ? 'auto' : '50%',
                            marginRight: detectedNote?.cents && detectedNote.cents > 0 ? 'auto' : '50%'
                        }}
                    />
                </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-inner group transition-all hover:border-gray-700">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-emerald-500 transition-colors">Detected Note</span>
                <div className="text-3xl font-bold text-white mt-1">
                    {detectedNote ? detectedNote.note : "---"}
                </div>
            </div>
        </div>

        {/* The Instrument */}
        <div className="relative pt-12 pb-16 px-4 sm:px-8 bg-gray-950 rounded-3xl overflow-hidden border border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
                 style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #34d399 0%, transparent 70%)'}} />
            
            <div className="relative z-10">
                <div className="harmonica-cover-plate mb-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-50 skew-x-12 translate-x-1/2" />
                </div>
                
                <div className="harmonica-comb">
                    <div className="grid grid-cols-10 gap-2 sm:gap-4">
                        {Array.from({ length: 10 }, (_, i) => renderHole(i))}
                    </div>
                </div>

                <div className="harmonica-cover-plate harmonica-cover-plate-bottom mt-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 opacity-50 -skew-x-12 -translate-x-1/2" />
                </div>
            </div>

            {error && (
                <div className="absolute inset-0 z-20 backdrop-blur-md flex items-center justify-center p-6 text-center">
                    <div className="max-w-xs bg-gray-900 border border-red-900/50 p-6 rounded-2xl shadow-2xl">
                        <div className="text-red-400 font-bold mb-4">{error}</div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsListening(false);
                                window.setTimeout(() => setIsListening(true), 10);
                            }}
                            className="w-full bg-red-500 text-white font-bold py-2 rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Reset Audio Engine
                        </button>
                    </div>
                </div>
            )}
            
            {!isListening && !error && (
                <div className="absolute inset-0 z-20 bg-gray-950/40 backdrop-blur-[2px] flex items-center justify-center">
                    <button
                        type="button"
                        onClick={() => setIsListening(true)}
                        className="bg-emerald-500 text-white font-black px-10 py-4 rounded-2xl shadow-2xl shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all tracking-widest"
                    >
                        INITIALIZE MONITOR
                    </button>
                </div>
            )}
        </div>

        <div className="mt-8 text-center">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">
                NoteBender Harmonica Core v2.0 • Diatonic Model
            </p>
        </div>
      </div>
    </div>
  );
}

export default Harmonica;
