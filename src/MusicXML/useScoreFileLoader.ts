import { useCallback, useEffect, useMemo } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { readBinaryScoreFile, readMusicXmlFile } from "./musicXmlFile";
import { getScoreFormat } from "./scoreFormat";
import type { ScoreFormat } from "./scoreFormat";
import { parseMidiFile } from "./midiParser";

export type ScoreFileContent = string | Uint8Array;

export type LoadedScoreFile = {
  content: ScoreFileContent;
  fileName: string;
  format: ScoreFormat;
};

export type BeforeScoreFileCommit = (loadedFile: LoadedScoreFile) => void;

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
  const scoreFormat = useMemo(() => getScoreFormat(fileName), [fileName]);
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
      })
      .catch(onDefaultLoadError);
  }, [fileName, onDefaultLoadError, rawFileContent, setFileName, setRawFileContent]);

  const loadScoreFile = useCallback(async (
    file: File,
    beforeCommit?: BeforeScoreFileCommit,
  ): Promise<LoadedScoreFile> => {
    const format = getScoreFormat(file.name);
    if (!format) {
      throw new Error("Unsupported score file format.");
    }

    const content = format === "midi"
      ? await readBinaryScoreFile(file)
      : await readMusicXmlFile(file);
    if (format === "midi" && content instanceof Uint8Array) {
      parseMidiFile(content, file.name);
    }
    const loadedFile = {
      content,
      fileName: file.name,
      format,
    };
    beforeCommit?.(loadedFile);
    setFileName(loadedFile.fileName);
    setRawFileContent(loadedFile.content);
    return loadedFile;
  }, [setFileName, setRawFileContent]);

  return {
    fileName,
    isGpFile,
    isMidiFile,
    loadScoreFile,
    rawFileContent,
    scoreFormat,
  };
};
