import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link2, Library, LoaderCircle, RefreshCw, RotateCcw, Search, Settings, Star, Upload, X } from "lucide-react";
import { Link } from "react-router-dom";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  clearScoreLibraryCatalogCache,
  loadScoreLibraryCatalog,
  ScoreLibraryCatalogError,
} from "./scoreLibrary";
import type {
  LibraryEntry,
  ScoreLibraryCatalog,
  ScoreLibraryDifficulty,
  ScoreLibraryFormat,
} from "./scoreLibrary";
import {
  getScoreLibraryDownloadErrorMessage,
  ScoreLibraryDownloadError,
} from "./scoreLibraryDownload";
import { filterScoreLibraryEntries } from "./scoreLibraryFilter";
import type { ScoreLibrarySourceFilter } from "./scoreLibraryFilter";
import {
  FAVORITE_SCORE_IDS_STORAGE_KEY,
  sanitizeFavoriteScoreIds,
  toggleFavoriteScoreId,
} from "./scoreLibraryFavorites";
import { useUserScoreLibrary } from "./UserScoreLibraryContext";
import { USER_SCORE_FILE_ACCEPT } from "./userScoreLibrary";

type ScoreLibraryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onLoadScore: (entry: LibraryEntry, signal: AbortSignal) => Promise<void>;
};

type FilterValue<T extends string> = T | "all";

const formatBadge = (entry: LibraryEntry) => {
  if (entry.sourceKind === "user") {
    const format = entry.format === "musicxml" ? "MXL" : entry.format === "guitar-pro" ? "GP" : "MIDI";
    return `LOCAL · ${format}`;
  }
  if (entry.format === "musicxml") return "MXL";
  return "GP";
};

export const ScoreLibraryDialog = ({
  isOpen,
  onClose,
  onLoadScore,
}: ScoreLibraryDialogProps) => {
  const userLibrary = useUserScoreLibrary();
  const userLibraryPermission = userLibrary.permission;
  const rescanUserLibrary = userLibrary.rescan;
  const [catalog, setCatalog] = useState<ScoreLibraryCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ isError: boolean; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<FilterValue<ScoreLibraryDifficulty>>("all");
  const [format, setFormat] = useState<FilterValue<ScoreLibraryFormat>>("all");
  const [source, setSource] = useState<ScoreLibrarySourceFilter>("all");
  const [tag, setTag] = useState("all");
  const [favoriteIds, setFavoriteIds] = usePersistentState<string[]>(
    FAVORITE_SCORE_IDS_STORAGE_KEY,
    [],
    { sanitize: sanitizeFavoriteScoreIds },
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);

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
            : "The public score catalog could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [catalog, catalogAttempt, isOpen]);

  useEffect(() => {
    if (isOpen && userLibraryPermission === "granted") void rescanUserLibrary();
  }, [isOpen, rescanUserLibrary, userLibraryPermission]);

  const entries = useMemo<readonly LibraryEntry[]>(
    () => [...(catalog?.entries ?? []), ...userLibrary.index.entries],
    [catalog, userLibrary.index.entries],
  );

  const availableTags = useMemo(
    () => [...new Set(catalog?.entries.flatMap((entry) => [...entry.tags]) ?? [])].sort(
      (left, right) => left.localeCompare(right),
    ),
    [catalog],
  );

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filteredScores = useMemo(() => filterScoreLibraryEntries(entries, {
    difficulty,
    favoriteIds: favoriteIdSet,
    format,
    query,
    source,
    tag,
  }), [difficulty, entries, favoriteIdSet, format, query, source, tag]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
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

  const loadScore = async (entry: LibraryEntry) => {
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
      setErrorMessage(
        error instanceof ScoreLibraryDownloadError
          ? getScoreLibraryDownloadErrorMessage(error)
          : error instanceof Error
            ? error.message
            : "Could not load that score.",
      );
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setLoadingId(null);
    }
  };

  const selectClassName =
    "rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500";
  const hasActiveFilters =
    query !== "" || difficulty !== "all" || format !== "all" || source !== "all" || tag !== "all";
  const resetFilters = () => {
    setQuery("");
    setDifficulty("all");
    setFormat("all");
    setSource("all");
    setTag("all");
  };
  const refreshCatalog = () => {
    clearScoreLibraryCatalogCache();
    setCatalog(null);
    setCatalogError(null);
    setCatalogAttempt((value) => value + 1);
    void userLibrary.rescan();
  };
  const importLocalScores = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || isImporting) return;
    setIsImporting(true);
    setImportMessage(null);
    try {
      const result = await userLibrary.importFiles(files);
      setImportMessage({
        isError: result.errors.length > 0,
        text: `${result.copied} copied, ${result.skipped} skipped${result.errors.length ? `, ${result.errors.length} errors` : ""}.`,
      });
    } catch (error) {
      setImportMessage({
        isError: true,
        text: error instanceof Error ? error.message : "Local scores could not be added.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const hasFolder = Boolean(userLibrary.directoryHandle);
  const hasFolderPermission = userLibrary.permission === "granted";
  const toggleFavorite = (entryId: string) => {
    setFavoriteIds(toggleFavoriteScoreId(favoriteIds, entryId));
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()} role="presentation">
      <section aria-labelledby="score-library-title" aria-modal="true" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2"><Library className="text-emerald-400" size={20} /><h2 id="score-library-title" className="text-lg font-black text-white">Score Library</h2></div>
            <p className="mt-1 text-xs text-gray-400">Public scores and private files stored in your chosen folder.</p>
          </div>
          <button aria-label="Close score library" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white" onClick={closeDialog} type="button"><X size={18} /></button>
        </header>

        <div className="space-y-3 border-b border-gray-800 px-4 py-3 sm:px-6">
          <label className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <span className="sr-only">Search scores</span>
            <input autoFocus className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" onChange={(event) => setQuery(event.target.value)} placeholder="Search title, composer, arranger, or file name..." type="search" value={query} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by source" className={selectClassName} onChange={(event) => setSource(event.target.value as ScoreLibrarySourceFilter)} value={source}>
              <option value="all">All sources</option><option value="public">Public</option><option value="user">My files</option><option value="favorites">Favourites ({favoriteIds.length})</option>
            </select>
            <select aria-label="Filter by format" className={selectClassName} onChange={(event) => setFormat(event.target.value as FilterValue<ScoreLibraryFormat>)} value={format}>
              <option value="all">All formats</option><option value="musicxml">MusicXML</option><option value="guitar-pro">Guitar Pro</option><option value="midi">MIDI</option>
            </select>
            <select aria-label="Filter by difficulty" className={selectClassName} onChange={(event) => setDifficulty(event.target.value as FilterValue<ScoreLibraryDifficulty>)} value={difficulty}>
              <option value="all">All difficulties</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <select aria-label="Filter by tag" className={selectClassName} onChange={(event) => setTag(event.target.value)} value={tag}>
              <option value="all">All tags</option>{availableTags.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-gray-800 disabled:opacity-40" disabled={!hasActiveFilters} onClick={resetFilters} type="button"><RotateCcw size={14} /> Reset filters</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-gray-800 disabled:opacity-50" disabled={userLibrary.isScanning} onClick={refreshCatalog} type="button"><RefreshCw className={userLibrary.isScanning ? "animate-spin" : ""} size={14} /> Refresh</button>
            {hasFolderPermission ? (
              <>
                <input accept={USER_SCORE_FILE_ACCEPT} className="hidden" multiple onChange={(event) => void importLocalScores(event)} ref={localFileInputRef} type="file" />
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50" disabled={isImporting} onClick={() => localFileInputRef.current?.click()} type="button">
                  {isImporting ? <LoaderCircle className="animate-spin" size={14} /> : <Upload size={14} />}{isImporting ? "Adding…" : "Add files"}
                </button>
              </>
            ) : hasFolder ? (
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600" onClick={() => void userLibrary.reconnect()} type="button"><Link2 size={14} /> Reconnect folder</button>
            ) : (
              <Link className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-gray-700" onClick={closeDialog} to="/settings"><Settings size={14} /> Set up local library</Link>
            )}
            <span className="ml-auto text-xs text-gray-400">{filteredScores.length} of {entries.length} scores</span>
          </div>
        </div>

        {catalogError && <div className="mx-4 mt-4 rounded-xl border border-amber-800 bg-amber-950/60 px-4 py-3 text-sm text-amber-100">{catalogError} Your local files are still available.</div>}
        {importMessage && <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${importMessage.isError ? "border-amber-800 bg-amber-950/60 text-amber-100" : "border-emerald-800 bg-emerald-950/70 text-emerald-200"}`}>{importMessage.text}</div>}
        {errorMessage && <div className="mx-4 mt-4 rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-200 sm:mx-6">{errorMessage} Select the score again to retry.</div>}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!catalog && !catalogError && entries.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><LoaderCircle className="animate-spin" size={18} /> Loading catalog…</div>
          ) : filteredScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No matching scores found.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredScores.map((entry) => {
                const publicEntry = entry.sourceKind === "public" ? entry : null;
                const userEntry = entry.sourceKind === "user" ? entry : null;
                const isFavorite = favoriteIdSet.has(entry.id);
                return (
                  <article className="relative rounded-xl border border-gray-700 bg-gray-950/70 transition hover:border-emerald-600 hover:bg-gray-800" key={entry.id}>
                    <button
                      aria-label={`${isFavorite ? "Remove" : "Add"} ${entry.title} ${isFavorite ? "from" : "to"} favourites`}
                      aria-pressed={isFavorite}
                      className={`absolute right-3 top-3 z-10 rounded-lg border p-1.5 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70 ${isFavorite ? "border-amber-500/60 bg-amber-950/70 text-amber-400 hover:bg-amber-900/70" : "border-gray-700 bg-gray-900 text-gray-500 hover:border-amber-600 hover:text-amber-300"}`}
                      onClick={() => toggleFavorite(entry.id)}
                      title={isFavorite ? "Remove from favourites" : "Add to favourites"}
                      type="button"
                    >
                      <Star className={isFavorite ? "fill-current" : ""} size={17} />
                    </button>
                    <button className="group w-full p-4 pr-14 text-left disabled:opacity-50" disabled={Boolean(loadingId)} onClick={() => void loadScore(entry)} type="button">
                      <div className="flex items-start gap-2"><h3 className="font-bold leading-snug text-white">{entry.title}</h3><span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-400">{formatBadge(entry)}</span></div>
                      <p className="mt-1 text-xs text-gray-400">{entry.composer || (entry.sourceKind === "user" ? entry.fileName : "Unknown composer")}</p>
                      {publicEntry ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">{publicEntry.difficulty}</span>{publicEntry.tags.map((value) => <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400" key={value}>{value}</span>)}</div>
                          <p className="mt-3 text-[10px] leading-relaxed text-gray-500">Source: {publicEntry.source.name}<br />License: {publicEntry.license.kind}</p>
                        </>
                      ) : (
                        <p className="mt-3 truncate text-[10px] text-gray-500" title={userEntry?.relativePath}>{userEntry?.relativePath}</p>
                      )}
                      {loadingId === entry.id && <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><LoaderCircle className="animate-spin" size={13} /> Loading…</span>}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
