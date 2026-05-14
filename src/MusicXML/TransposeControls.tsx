import { RotateCcw } from "lucide-react";

type TransposeControlsProps = {
  noBend: boolean;
  noOverblowOrDraw: boolean;
  onAutoTranspose: () => void;
  onNoBendChange: (checked: boolean) => void;
  onNoOverblowOrDrawChange: (checked: boolean) => void;
  onResetTranspose: () => void;
  onShowNoteNamesChange: (checked: boolean) => void;
  onTransposeChange: (value: string) => void;
  optimalVariantsCount: number;
  showNoteNames: boolean;
  transpose: number;
};

export const TransposeControls = ({
  noBend,
  noOverblowOrDraw,
  onAutoTranspose,
  onNoBendChange,
  onNoOverblowOrDrawChange,
  onResetTranspose,
  onShowNoteNamesChange,
  onTransposeChange,
  optimalVariantsCount,
  showNoteNames,
  transpose,
}: TransposeControlsProps) => (
  <div className="w-full lg:w-72 shrink-0 bg-gray-900 rounded-xl shadow-xl p-5 space-y-5 border border-gray-700 overflow-y-auto max-h-full custom-scrollbar">
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
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Auto Optimizer</p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={noOverblowOrDraw}
            onChange={(e) => onNoOverblowOrDrawChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-950"
          />
          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-tight">No Overblow/Draw</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={noBend}
            onChange={(e) => onNoBendChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-950"
          />
          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-tight">No Bends</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={showNoteNames}
            onChange={(e) => onShowNoteNamesChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-950"
          />
          <span className="text-xs font-bold text-emerald-500/80 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">Show Note Names</span>
        </label>
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
        Optimization uses advanced pitch analysis to find the best key for your harmonica model.
      </p>
    </div>
  </div>
);
