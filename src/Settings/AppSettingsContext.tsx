import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import type { InputMode } from "../MusicXML/inputMode";
import { sanitizeInputMode } from "../MusicXML/inputMode";
import type { MelodicaKeyCount } from "../utils/utils";
import { normalizeMelodicaKeyCount } from "../utils/utils";
import { sanitizeMelodicaKeyCount, sanitizeSoundFont } from "./appSettings";

type AppSettingsValue = {
  inputMode: InputMode;
  melodicaRange: MelodicaKeyCount;
  setInputMode: (mode: InputMode) => void;
  setMelodicaRange: (range: MelodicaKeyCount) => void;
  setSoundFont: (soundFont: string) => void;
  soundFont: string;
};

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [melodicaRange, setMelodicaRange] = usePersistentState<MelodicaKeyCount>(
    "melodicatrainer_key_count",
    32,
    { sanitize: sanitizeMelodicaKeyCount },
  );
  const [inputMode, setInputMode] = usePersistentState<InputMode>(
    "melodicatrainer_input_mode",
    "auto",
    { sanitize: sanitizeInputMode },
  );
  const [soundFont, setSoundFont] = usePersistentState<string>(
    "melodicatrainer_soundfont",
    "melodica.sf2",
    {
      legacyKeys: ["harptrainer_soundfont"],
      sanitize: sanitizeSoundFont,
    },
  );

  return (
    <AppSettingsContext.Provider value={{
      inputMode,
      melodicaRange: normalizeMelodicaKeyCount(melodicaRange),
      setInputMode,
      setMelodicaRange,
      setSoundFont,
      soundFont,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("App settings context is missing.");
  return context;
};
