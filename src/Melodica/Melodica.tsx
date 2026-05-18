import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  generateMelodicaLayout,
  getMelodicaMidiNumbers,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import {
  MelodicaHeaderPanel,
  MelodicaKeyboardPanel,
  MelodicaListeningPanel,
} from "./MelodicaPanels";
import { useMelodicaViewModel } from "./useMelodicaViewModel";

function Melodica() {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [keyCount, setKeyCount] = useState<MelodicaKeyCount>(32);
  const layout = useMemo(() => generateMelodicaLayout(keyCount), [keyCount]);
  const allowedMidiNumbers = useMemo(
    () => new Set(getMelodicaMidiNumbers(layout)),
    [layout]
  );
  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });
  const { detectedMidi, detectedNote, keyboardRangeLabel, rangeSummary } =
    useMelodicaViewModel({ layout, pitch });

  return (
    <div className="flex min-h-full flex-col bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
        <MelodicaHeaderPanel
          keyCount={keyCount}
          onKeyCountChange={setKeyCount}
          rangeSummary={rangeSummary}
        />

        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <MelodicaListeningPanel
            clarity={clarity}
            detectedNote={detectedNote}
            error={error}
            isListening={isListening}
            onListeningToggle={() => setIsListening((value) => !value)}
            pitch={pitch}
          />
          <MelodicaKeyboardPanel
            detectedMidi={detectedMidi}
            detectedNote={detectedNote}
            keyboardRangeLabel={keyboardRangeLabel}
            layout={layout}
            t={t}
          />
        </section>
      </div>
    </div>
  );
}

export default Melodica;
