const DEBUG_STORAGE_KEY = "melodicatrainer_debug_logs";
const LEGACY_DEBUG_STORAGE_KEY = "harptrainer_debug_logs";

const isStorageDebugEnabled = () => {
  try {
    return (
      globalThis.localStorage?.getItem(DEBUG_STORAGE_KEY) === "true" ||
      globalThis.localStorage?.getItem(LEGACY_DEBUG_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
};

export const isMusicXmlDebugEnabled = () =>
  import.meta.env.VITE_MELODICATRAINER_DEBUG === "true" ||
  import.meta.env.VITE_HARPTRAINER_DEBUG === "true" ||
  isStorageDebugEnabled();

export const musicXmlDebugLogger = {
  log: (...args: unknown[]) => {
    if (isMusicXmlDebugEnabled()) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isMusicXmlDebugEnabled()) {
      console.warn(...args);
    }
  },
};
