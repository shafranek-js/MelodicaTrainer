const DEBUG_STORAGE_KEY = "harptrainer_debug_logs";

const isStorageDebugEnabled = () => {
  try {
    return globalThis.localStorage?.getItem(DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const isMusicXmlDebugEnabled = () =>
  import.meta.env.VITE_HARPTRAINER_DEBUG === "true" || isStorageDebugEnabled();

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
