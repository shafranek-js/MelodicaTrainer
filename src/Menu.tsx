import React from "react";
import { Link } from "react-router-dom";
import { Coffee, Github } from "lucide-react";
import NotationSwitch from "./NotationSwitch";

const Menu: React.FC = () => (
  <nav className="flex flex-wrap items-center gap-3 border-b border-gray-400 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-3 sm:flex-nowrap sm:justify-between sm:p-4">
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto sm:flex-1 sm:gap-6">
      <Link
        to="/circle"
        className="whitespace-nowrap text-sm font-semibold text-white transition-colors duration-300 hover:text-green-400 sm:text-base"
      >
        Circle
      </Link>
      <Link
        to="/harmonica"
        className="whitespace-nowrap text-sm font-semibold text-white transition-colors duration-300 hover:text-green-400 sm:text-base"
      >
        Harmonica
      </Link>
      <Link
        to="/musicxml"
        className="whitespace-nowrap text-sm font-semibold text-white transition-colors duration-300 hover:text-green-400 sm:text-base"
      >
        Tabs
      </Link>
      <Link
        to="/practice"
        className="whitespace-nowrap text-sm font-semibold text-white transition-colors duration-300 hover:text-green-400 sm:text-base"
      >
        Practice
      </Link>
    </div>

    {/* Right-side controls (GitHub + NotationSwitch) */}
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
      <div className="shrink-0 rounded bg-cyan-700 px-3 py-1 text-xs text-white shadow hover:bg-cyan-600">
        <NotationSwitch />
      </div>
      <a
        href="https://buymeacoffee.com/ikzzet"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-2 rounded bg-yellow-500 px-2.5 py-1.5 text-sm font-semibold text-gray-950 shadow transition hover:bg-yellow-400 sm:px-3"
        title="Buy me a coffee"
        aria-label="Buy me a coffee"
      >
        <Coffee className="h-4 w-4" />
        <span className="hidden sm:inline">Buy me a coffee</span>
      </a>
      <a
        href="https://github.com/izabala033/NoteBender"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-white transition-colors duration-300 hover:text-green-400"
        title="GitHub Repository"
        aria-label="GitHub Repository"
      >
        <Github className="w-6 h-6" />
      </a>
    </div>
  </nav>
);

export default Menu;
