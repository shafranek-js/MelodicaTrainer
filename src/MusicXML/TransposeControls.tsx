import { RotateCcw, Pin, PinOff } from "lucide-react";

const FINGERING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "numbers", label: "Numbers on notes" },
  { value: "virtualHand", label: "Virtual hand" },
] as const;

type TransposeControlsProps = {
  onAutoTranspose: () => void;
  onResetTranspose: () => void;
  onFingeringGuideChange?: (value: string) => void;
  onShowNoteNamesChange: (checked: boolean) => void;
  onStudyModeChange?: (checked: boolean) => void;
  onTransposeChange: (value: string) => void;
  optimalVariantsCount: number;
  fingeringGuide?: string;
  isStudyMode?: boolean;
  showNoteNames: boolean;
  transpose: number;
  isPinned: boolean;
  onTogglePin: () => void;
};

export const TransposeControls = ({
  onAutoTranspose,
  onResetTranspose,
  onFingeringGuideChange,
  onShowNoteNamesChange,
  onStudyModeChange,
  onTransposeChange,
  optimalVariantsCount,
  fingeringGuide,
  isStudyMode,
  showNoteNames,
  transpose,
  isPinned,
  onTogglePin,
}: TransposeControlsProps) => (
  <div className="w-full lg:w-72 shrink-0 bg-gray-900 rounded-xl shadow-xl p-5 space-y-5 border border-gray-700 overflow-y-auto max-h-full custom-scrollbar relative">
    <button
      onClick={onTogglePin}
      className="hidden lg:flex absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors p-1"
      title={isPinned ? "Unpin panel" : "Pin panel"}
    >
      {isPinned ? <Pin size={16} className="text-emerald-500" /> : <PinOff size={16} />}
    </button>

    <div>
      <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Transpose</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={transpose}
          onChange={(e) => onTransposeChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 w-full text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
        <button onClick={onResetTranspose} className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 p-2 rounded-lg transition-all" title="Reset transpose">
          <RotateCcw size={16} />
        </button>
      </div>
    </div>

    <div className="bg-gray-950/50 rounded-xl p-4 border border-gray-800 space-y-4">
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Display</p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={showNoteNames}
            onChange={(e) => onShowNoteNamesChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-950"
          />
          <span className="text-xs font-bold text-emerald-500/80 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">Show Note Names</span>
        </label>

        {onFingeringGuideChange && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Fingering Guide</span>
            <select
              value={fingeringGuide ?? "numbers"}
              onChange={(e) => onFingeringGuideChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 w-full text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              {FINGERING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}

        {onStudyModeChange && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isStudyMode ?? false}
              onChange={(e) => onStudyModeChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-950"
            />
            <span className="text-xs font-bold text-amber-400/80 group-hover:text-amber-300 transition-colors uppercase tracking-tight">Study Mode</span>
          </label>
        )}
      </div>

      <button
        onClick={onAutoTranspose}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl transition-all w-full shadow-lg shadow-emerald-900/20 active:scale-95"
      >
        🎯 Optimize {optimalVariantsCount > 0 ? `(${optimalVariantsCount} v)` : ""}
      </button>
    </div>

    <div className="bg-emerald-900/10 border border-emerald-500/10 rounded-lg p-3">
      <p className="text-[9px] text-gray-500 font-bold leading-tight uppercase tracking-tighter">
        Optimization searches for a transpose value that fits the selected melodica range.
      </p>
    </div>
  </div>
);
