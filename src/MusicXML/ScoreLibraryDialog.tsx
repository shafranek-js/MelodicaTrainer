import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Library, LoaderCircle, Search, X } from "lucide-react";
import {
  MUSETRAINER_LIBRARY_PAGE_URL,
  SCORE_LIBRARY,
} from "./scoreLibrary";
import type { ScoreLibraryEntry } from "./scoreLibrary";
import {
  getScoreLibraryDownloadErrorMessage,
  ScoreLibraryDownloadError,
} from "./scoreLibraryDownload";

type ScoreLibraryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onLoadScore: (entry: ScoreLibraryEntry, signal: AbortSignal) => Promise<void>;
};

export const ScoreLibraryDialog = ({
  isOpen,
  onClose,
  onLoadScore,
}: ScoreLibraryDialogProps) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const filteredScores = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return SCORE_LIBRARY;

    return SCORE_LIBRARY.filter((entry) =>
      [entry.title, entry.composer, ...entry.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setQuery("");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      abortControllerRef.current?.abort();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  if (!isOpen) return null;

  const closeDialog = () => {
    abortControllerRef.current?.abort();
    onClose();
  };

  const loadScore = async (entry: ScoreLibraryEntry) => {
    if (loadingId) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setErrorMessage(null);
    setLoadingId(entry.id);

    try {
      await onLoadScore(entry, controller.signal);
      onClose();
    } catch (error) {
      if (
        error instanceof ScoreLibraryDownloadError &&
        error.reason === "cancelled"
      ) {
        return;
      }
      setErrorMessage(getScoreLibraryDownloadErrorMessage(error));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="score-library-title"
        aria-modal="true"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Library className="text-emerald-400" size={20} />
              <h2 id="score-library-title" className="text-lg font-black text-white">
                MusicXML Library
              </h2>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Public-domain scores loaded directly from MuseTrainer.
            </p>
          </div>
          <button
            aria-label="Close score library"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            onClick={closeDialog}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-gray-800 px-4 py-3 sm:px-6">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              size={16}
            />
            <span className="sr-only">Search scores</span>
            <input
              autoFocus
              className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, composer, or tag..."
              type="search"
              value={query}
            />
          </label>
        </div>

        {errorMessage && (
          <div className="mx-4 mt-4 rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-200 sm:mx-6">
            {errorMessage} Select the score again to retry.
          </div>
        )}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {filteredScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No matching scores found.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filteredScores.map((entry) => {
                const isLoading = loadingId === entry.id;
                return (
                  <li
                    className="flex min-h-36 flex-col rounded-xl border border-gray-700 bg-gray-950/70 p-4"
                    key={entry.id}
                  >
                    <h3 className="font-bold leading-snug text-white">{entry.title}</h3>
                    <p className="mt-1 text-xs text-gray-400">{entry.composer}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span
                          className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={loadingId !== null}
                      onClick={() => void loadScore(entry)}
                      type="button"
                    >
                      {isLoading ? (
                        <>
                          <LoaderCircle className="animate-spin" size={15} />
                          Loading
                        </>
                      ) : (
                        "Load score"
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-gray-800 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a
            className="inline-flex items-center gap-1 text-gray-400 transition hover:text-emerald-400"
            href={MUSETRAINER_LIBRARY_PAGE_URL}
            rel="noreferrer"
            target="_blank"
          >
            Source: MuseTrainer Library <ExternalLink size={12} />
          </a>
          {loadingId && (
            <button
              className="rounded-lg border border-gray-700 px-3 py-1.5 font-bold text-gray-300 transition hover:bg-gray-800"
              onClick={() => abortControllerRef.current?.abort()}
              type="button"
            >
              Cancel download
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};
