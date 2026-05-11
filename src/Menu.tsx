import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Gauge, Github, Pause, Play, RotateCcw } from "lucide-react";
import NotationSwitch from "./NotationSwitch";

type GameStats = {
  hits: number;
  misses: number;
  streak: number;
};

type MenuProps = {
  isPlaying?: boolean;
  onTogglePlayback?: () => void;
  onRestartPlayback?: () => void;
  tempo?: number;
  setTempo?: (tempo: number) => void;
  progress?: number;
  gameStats?: GameStats;
  accuracy?: number;
  canPlayback?: boolean;
};

const Menu: React.FC<MenuProps> = ({
  isPlaying,
  onTogglePlayback,
  onRestartPlayback,
  tempo,
  setTempo,
  progress,
  gameStats,
  accuracy,
  canPlayback,
}) => {
  const location = useLocation();
  const isTabsPage = location.pathname === "/musicxml";

  return (
    <nav className="flex flex-col border-b border-gray-700 bg-gray-900 shadow-lg shrink-0 z-50">
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
            to="/harmonica"
            className={`whitespace-nowrap text-sm font-bold transition-colors ${
              location.pathname === "/harmonica" ? "text-green-400" : "text-white hover:text-green-400"
            }`}
          >
            Harmonica
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
                {isPlaying ? "Pause" : "Play"}
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
              <div className="flex items-center gap-2 rounded bg-gray-800/50 px-2 py-1 border border-gray-700/50">
                <Gauge size={12} className="text-gray-400" />
                <input
                  type="range"
                  min="40"
                  max="180"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-20 h-1 accent-emerald-500"
                />
                <span className="min-w-[45px] text-[10px] font-mono text-emerald-400">{tempo} BPM</span>
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
          <div className="shrink-0 rounded bg-cyan-800/50 px-2 py-0.5 text-[10px] text-white border border-cyan-700/50">
            <NotationSwitch />
          </div>
          <a
            href="https://github.com/izabala033/NoteBender"
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
