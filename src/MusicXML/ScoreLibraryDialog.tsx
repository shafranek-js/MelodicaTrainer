import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Library, LoaderCircle, Search, X } from "lucide-react";
import {
  loadScoreLibraryCatalog,
  ScoreLibraryCatalogError,
} from "./scoreLibrary";
import type {
  ScoreLibraryCatalog,
  ScoreLibraryDifficulty,
  ScoreLibraryEntry,
  ScoreLibraryFormat,
} from "./scoreLibrary";
import {
  getScoreLibraryDownloadErrorMessage,
  ScoreLibraryDownloadError,
} from "./scoreLibraryDownload";
import { filterScoreLibraryEntries } from "./scoreLibraryFilter";

type ScoreLibraryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onLoadScore: (entry: ScoreLibraryEntry, signal: AbortSignal) => Promise<void>;
};

type FilterValue<T extends string> = T | "all";

export const ScoreLibraryDialog = ({
  isOpen,
  onClose,
  onLoadScore,
}: ScoreLibraryDialogProps) => {
  const [catalog, setCatalog] = useState<ScoreLibraryCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<FilterValue<ScoreLibraryDifficulty>>("all");
  const [format, setFormat] = useState<FilterValue<ScoreLibraryFormat>>("all");
  const [tag, setTag] = useState("all");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen || catalog) return;
    let active = true;
    setCatalogError(null);
    void loadScoreLibraryCatalog()
      .then((loadedCatalog) => {
        if (active) setCatalog(loadedCatalog);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalogError(
          error instanceof ScoreLibraryCatalogError
            ? error.message
            : "The score library catalog could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [catalog, catalogAttempt, isOpen]);

  const availableTags = useMemo(
    () =>
      [...new Set(catalog?.entries.flatMap((entry) => [...entry.tags]) ?? [])].sort(
        (left, right) => left.localeCompare(right),
      ),
    [catalog],
  );

  const filteredScores = useMemo(() => {
    return filterScoreLibraryEntries(catalog?.entries ?? [], {
      difficulty,
      format,
      query,
      tag,
    });
  }, [catalog, difficulty, format, query, tag]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setQuery("");
      setDifficulty("all");
      setFormat("all");
      setTag("all");
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

  useEffect(() => () => abortControllerRef.current?.abort(), []);

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
      if (error instanceof ScoreLibraryDownloadError && error.reason === "cancelled") return;
      setErrorMessage(getScoreLibraryDownloadErrorMessage(error));
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setLoadingId(null);
    }
  };

  const selectClassName =
    "rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()} role="presentation">
      <section aria-labelledby="score-library-title" aria-modal="true" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Library className="text-emerald-400" size={20} />
              <h2 id="score-library-title" className="text-lg font-black text-white">Score Library</h2>
            </div>
            <p className="mt-1 text-xs text-gray-400">Curated public-domain and CC0 scores stored with Melodica Trainer.</p>
          </div>
          <button aria-label="Close score library" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white" onClick={closeDialog} type="button"><X size={18} /></button>
        </header>

        <div className="space-y-3 border-b border-gray-800 px-4 py-3 sm:px-6">
          <label className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <span className="sr-only">Search scores</span>
            <input autoFocus className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" onChange={(event) => setQuery(event.target.value)} placeholder="Search title, composer, arranger, or tag..." type="search" value={query} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by format" className={selectClassName} onChange={(event) => setFormat(event.target.value as FilterValue<ScoreLibraryFormat>)} value={format}>
              <option value="all">All formats</option><option value="musicxml">MusicXML</option><option value="guitar-pro">Guitar Pro</option>
            </select>
            <select aria-label="Filter by difficulty" className={selectClassName} onChange={(event) => setDifficulty(event.target.value as FilterValue<ScoreLibraryDifficulty>)} value={difficulty}>
              <option value="all">All difficulties</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <select aria-label="Filter by tag" className={selectClassName} onChange={(event) => setTag(event.target.value)} value={tag}>
              <option value="all">All tags</option>{availableTags.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            {catalog && <span className="ml-auto text-xs text-gray-400">{filteredScores.length} of {catalog.entries.length} scores</span>}
          </div>
        </div>

        {errorMessage && <div className="mx-4 mt-4 rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-200 sm:mx-6">{errorMessage} Select the score again to retry.</div>}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!catalog && !catalogError ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><LoaderCircle className="animate-spin" size={18} /> Loading catalog…</div>
          ) : catalogError ? (
            <div className="py-12 text-center text-sm text-red-200">
              <p>{catalogError}</p>
              <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500" onClick={() => setCatalogAttempt((value) => value + 1)} type="button">Retry catalog</button>
            </div>
          ) : filteredScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No matching scores found.</div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredScores.map((entry) => {
                const isLoading = loadingId === entry.id;
                return (
                  <li className="flex min-h-64 flex-col rounded-xl border border-gray-700 bg-gray-950/70 p-4" data-score-id={entry.id} key={entry.id}>
                    <div className="flex items-start justify-between gap-2"><h3 className="font-bold leading-snug text-white">{entry.title}</h3><span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-400">{entry.format === "musicxml" ? "MXL" : "GP"}</span></div>
                    <p className="mt-1 text-xs text-gray-400">{entry.composer}</p>
                    {entry.arranger && <p className="mt-0.5 text-[11px] text-gray-500">Arr. {entry.arranger}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">{entry.difficulty}</span>{entry.tags.map((value) => <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400" key={value}>{value}</span>)}</div>
                    <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                      <a className="inline-flex items-center gap-1 hover:text-emerald-400" href={entry.source.url} rel="noreferrer" target="_blank">Source: {entry.source.name} <ExternalLink size={10} /></a><br />
                      <a className="inline-flex items-center gap-1 hover:text-emerald-400" href={entry.license.url} rel="noreferrer" target="_blank">License: {entry.license.kind} <ExternalLink size={10} /></a>
                    </div>
                    <button className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={loadingId !== null} onClick={() => void loadScore(entry)} type="button">
                      {isLoading ? <><LoaderCircle className="animate-spin" size={15} /> Loading</> : "Load score"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {loadingId && <footer className="flex justify-end border-t border-gray-800 px-4 py-3 sm:px-6"><button className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-300 transition hover:bg-gray-800" onClick={() => abortControllerRef.current?.abort()} type="button">Cancel download</button></footer>}
      </section>
    </div>
  );
};
