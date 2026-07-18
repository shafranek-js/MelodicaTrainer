import { useCallback, useEffect, useMemo } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { readBinaryScoreFile, readMusicXmlFile } from "./musicXmlFile";
import { convertMsczWithHighFidelity } from "./msczHighFidelity";
import { convertMsczFile } from "./msczFile";
import { getScoreFileFormat, getScoreFormat } from "./scoreFormat";
import type { ScoreFileFormat, ScoreFormat } from "./scoreFormat";
import { parseMidiFile } from "./midiParser";

export type ScoreFileContent = string | Uint8Array;

export type LoadedScoreFile = {
  content: ScoreFileContent;
  fileName: string;
  format: ScoreFormat;
  sourceFormat: ScoreFileFormat;
  warnings: string[];
};

export type BeforeScoreFileCommit = (loadedFile: LoadedScoreFile) => void;

export type ScoreFileLoadOptions = {
  msczConverter?: "standard" | "high-fidelity";
};

export const isGuitarProFileName = (fileName: string | null) =>
  getScoreFormat(fileName) === "guitar-pro";

const sanitizeScoreFileContent = (value: unknown): ScoreFileContent | null | undefined => {
  if (value === null || typeof value === "string" || value instanceof Uint8Array) return value;
  return undefined;
};

const sanitizeFileName = (value: unknown): string | null | undefined => {
  if (value === null || typeof value === "string") return value;
  return undefined;
};

const sanitizeWarnings = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return undefined;
  return value.slice(0, 256);
};

type UseScoreFileLoaderOptions = {
  onDefaultLoadError: (error: unknown) => void;
};

const LEGACY_STORAGE_KEYS = {
  fileName: ["harptrainer_file_name"],
  rawContent: ["harptrainer_raw_content"],
} as const;

const DEFAULT_SCORE_FILE = "Aloutte (10-Hole Diatonic Harmonica).gp";
const LEGACY_DEFAULT_SCORE_FILES = new Set([
  "IntroSong.musicxml",
  "IntroSong-notebender.musicxml",
]);

export const shouldReplacePersistedDefaultScore = (
  rawFileContent: ScoreFileContent | null,
  fileName: string | null,
) =>
  Boolean(rawFileContent && fileName && LEGACY_DEFAULT_SCORE_FILES.has(fileName));

export const useScoreFileLoader = ({ onDefaultLoadError }: UseScoreFileLoaderOptions) => {
  const [rawFileContent, setRawFileContent] = usePersistentState<ScoreFileContent | null>(
    "melodicatrainer_raw_content",
    null,
    {
      legacyKeys: LEGACY_STORAGE_KEYS.rawContent,
      sanitize: sanitizeScoreFileContent,
      warnSerializedLength: 1_500_000,
    }
  );
  const [fileName, setFileName] = usePersistentState<string | null>(
    "melodicatrainer_file_name",
    null,
    { legacyKeys: LEGACY_STORAGE_KEYS.fileName, sanitize: sanitizeFileName }
  );
  const [conversionWarnings, setConversionWarnings] = usePersistentState<string[]>(
    "melodicatrainer_score_conversion_warnings",
    [],
    { sanitize: sanitizeWarnings },
  );
  const scoreFormat = useMemo(() => getScoreFormat(fileName), [fileName]);
  const sourceFormat = useMemo(() => getScoreFileFormat(fileName), [fileName]);
  const isGpFile = scoreFormat === "guitar-pro";
  const isMidiFile = scoreFormat === "midi";

  useEffect(() => {
    if (rawFileContent && !shouldReplacePersistedDefaultScore(rawFileContent, fileName)) return;

    fetch(`${import.meta.env.BASE_URL}${DEFAULT_SCORE_FILE}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${DEFAULT_SCORE_FILE}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        setFileName(DEFAULT_SCORE_FILE);
        setRawFileContent(new Uint8Array(buf));
        setConversionWarnings([]);
      })
      .catch(onDefaultLoadError);
  }, [fileName, onDefaultLoadError, rawFileContent, setConversionWarnings, setFileName, setRawFileContent]);

  const loadScoreFile = useCallback(async (
    file: File,
    beforeCommit?: BeforeScoreFileCommit,
    options: ScoreFileLoadOptions = {},
  ): Promise<LoadedScoreFile> => {
    const nextSourceFormat = getScoreFileFormat(file.name);
    if (!nextSourceFormat) {
      throw new Error("Unsupported score file format.");
    }

    const msczResult = nextSourceFormat === "musescore"
      ? options.msczConverter === "high-fidelity"
        ? await convertMsczWithHighFidelity(file)
        : await convertMsczFile(file)
      : null;
    const format: ScoreFormat = nextSourceFormat === "musescore"
      ? "musicxml"
      : nextSourceFormat;
    const content = msczResult
      ? msczResult.musicXml
      : format === "midi"
        ? await readBinaryScoreFile(file)
        : await readMusicXmlFile(file);
    if (format === "midi" && content instanceof Uint8Array) {
      parseMidiFile(content, file.name);
    }
    const loadedFile = {
      content,
      fileName: file.name,
      format,
      sourceFormat: nextSourceFormat,
      warnings: msczResult?.warnings ?? [],
    };
    beforeCommit?.(loadedFile);
    setFileName(loadedFile.fileName);
    setRawFileContent(loadedFile.content);
    setConversionWarnings(loadedFile.warnings);
    return loadedFile;
  }, [setConversionWarnings, setFileName, setRawFileContent]);

  return {
    fileName,
    conversionWarnings,
    isGpFile,
    isMidiFile,
    loadScoreFile,
    rawFileContent,
    scoreFormat,
    sourceFormat,
  };
};
