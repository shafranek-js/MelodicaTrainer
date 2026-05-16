import { useCallback, useEffect, useMemo } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { readMusicXmlFile } from "./musicXmlFile";

export type ScoreFileContent = string | Uint8Array;

export type LoadedScoreFile = {
  content: ScoreFileContent;
  fileName: string;
  isGpFile: boolean;
};

export const isGuitarProFileName = (fileName: string | null) =>
  fileName ? /\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName) : false;

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
  const isGpFile = useMemo(() => isGuitarProFileName(fileName), [fileName]);

  useEffect(() => {
    if (rawFileContent) return;

    const defaultFile = "Aloutte (10-Hole Diatonic Harmonica).gp";
    fetch(`${import.meta.env.BASE_URL}${defaultFile}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${defaultFile}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        setFileName(defaultFile);
        setRawFileContent(new Uint8Array(buf));
      })
      .catch(onDefaultLoadError);
  }, [onDefaultLoadError, rawFileContent, setFileName, setRawFileContent]);

  const loadScoreFile = useCallback(async (file: File): Promise<LoadedScoreFile> => {
    const content = await readMusicXmlFile(file);
    setFileName(file.name);
    setRawFileContent(content);
    return {
      content,
      fileName: file.name,
      isGpFile: isGuitarProFileName(file.name),
    };
  }, [setFileName, setRawFileContent]);

  return {
    fileName,
    isGpFile,
    loadScoreFile,
    rawFileContent,
  };
};
