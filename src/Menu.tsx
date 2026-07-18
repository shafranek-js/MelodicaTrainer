import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Gauge, Github, Minus, Pause, Play, Plus, Repeat2, RotateCcw, Pin, PinOff, Settings } from "lucide-react";
import NotationSwitch from "./NotationSwitch";
import { usePlaybackToolbarState } from "./PlaybackToolbarContext";

type MenuProps = {
  isPinned: boolean;
  onTogglePin: () => void;
};

const Menu: React.FC<MenuProps> = ({ isPinned, onTogglePin }) => {
  const location = useLocation();
  const isTabsPage = location.pathname === "/musicxml";
  const tabsState = usePlaybackToolbarState();
  const {
    isLooping,
    isPlaying,
    isPaused,
    onToggleLoop,
    onTogglePlayback,
    onRestartPlayback,
    tempo,
    setTempo,
    progress,
    gameStats,
    accuracy,
    canPlayback,
  } = tabsState ?? {};

  return (
    <nav className="flex flex-col border-b border-gray-700 bg-gray-900 shadow-lg shrink-0 z-50 relative">
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 sm:px-6">
        {/* Navigation Links */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to="/circle"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/circle" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Circle
          </Link>
          <Link
            to="/melodica"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/melodica" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Melodica
          </Link>
          <Link
            to="/musicxml"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/musicxml" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Tabs
          </Link>
          <Link
            to="/practice"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/practice" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Practice
          </Link>
          <Link
            to="/help"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/help" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Help
          </Link>
        </div>

        {/* Global Controls & Stats (Only on Tabs page) */}
        {isTabsPage && onTogglePlayback && (
          <div className="flex flex-1 flex-wrap items-center justify-center gap-4">
            {/* Playback Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePlayback}
                disabled={!canPlayback}
                className="flex h-8 items-center gap-2 rounded bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? "Pause" : (isPaused ? "Resume" : "Play")}
              </button>
              <button
                type="button"
                onClick={onToggleLoop}
                disabled={!canPlayback || !onToggleLoop}
                aria-pressed={Boolean(isLooping)}
                className={`flex h-8 items-center gap-2 rounded border px-3 text-xs font-bold transition disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 ${
                  isLooping
                    ? "border-emerald-500 bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                    : "border-gray-600 bg-gray-800 text-white hover:bg-gray-700"
                }`}
                title={isLooping ? "Disable loop" : "Loop melody"}
              >
                <Repeat2 size={14} />
                Loop
              </button>
              <button
                onClick={onRestartPlayback}
                disabled={!canPlayback}
                className="flex h-8 w-8 items-center justify-center rounded border border-gray-600 bg-gray-800 text-white transition hover:bg-gray-700 disabled:text-gray-500"
                title="Restart"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Tempo Slider */}
            {tempo !== undefined && setTempo && (
              <div className="flex items-center gap-1.5 rounded bg-gray-800/50 px-2 py-1 border border-gray-700/50">
                <Gauge size={12} className="text-gray-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => setTempo(Math.max(20, tempo - 5))}
                  className="flex h-5 w-5 items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition shrink-0"
                  title="-5 BPM"
                >
                  <Minus size={10} />
                </button>
                <input
                  type="range"
                  min="20"
                  max="240"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-28 h-1 accent-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setTempo(Math.min(240, tempo + 5))}
                  className="flex h-5 w-5 items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition shrink-0"
                  title="+5 BPM"
                >
                  <Plus size={10} />
                </button>
                <span className="min-w-[45px] text-[10px] font-mono text-emerald-400 text-right">{tempo} BPM</span>
              </div>
            )}

            {/* Stats Display */}
            {gameStats && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-emerald-400 border border-emerald-900/50">
                  Hits {gameStats.hits}
                </span>
                <span className="rounded bg-red-950/50 px-1.5 py-0.5 text-red-400 border border-red-900/50">
                  Miss {gameStats.misses}
                </span>
                <span className="rounded bg-cyan-950/50 px-1.5 py-0.5 text-cyan-400 border border-cyan-900/50">
                  Streak {gameStats.streak}
                </span>
                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-white border border-gray-700">
                  {accuracy}% ACC
                </span>
              </div>
            )}
          </div>
        )}

        {/* Right-side Utils */}
        <div className="flex items-center gap-4">
          <Link
            aria-label="Settings"
            className={`transition-colors ${location.pathname === "/settings" ? "text-green-400" : "text-white hover:text-green-400"}`}
            title="Settings"
            to="/settings"
          >
            <Settings size={18} />
          </Link>
          <button
            onClick={onTogglePin}
            className="hidden lg:flex text-gray-500 hover:text-gray-300 transition-colors p-1"
            title={isPinned ? "Unpin menu" : "Pin menu"}
          >
            {isPinned ? <Pin size={16} className="text-emerald-500" /> : <PinOff size={16} />}
          </button>
          <div className="shrink-0 rounded bg-cyan-800/50 px-2 py-0.5 text-[10px] text-white border border-cyan-700/50">
            <NotationSwitch />
          </div>
          <a
            href="https://github.com/shafranek-js/MelodicaTrainer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white transition-colors hover:text-green-400"
          >
            <Github size={18} />
          </a>
        </div>
      </div>

      {/* Progress Bar (Always visible at the bottom of nav on Tabs page) */}
      {isTabsPage && progress !== undefined && (
        <div className="h-1 w-full bg-gray-800">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </nav>
  );
};

export default Menu;
