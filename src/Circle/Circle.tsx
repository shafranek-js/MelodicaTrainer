import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleDiagram,
  LegendPanel,
  ModeControls,
  ScaleControls,
  ScaleTriadsPanel,
} from "./CirclePanels";
import {
  getCircleTheory,
  type CircleScaleValue,
} from "./circleTheory";
import { useCircleDimensions } from "./useCircleDimensions";

function Circle() {
  const [selectedRoot, setSelectedRoot] = useState("C");
  const [selectedMode, setSelectedMode] = useState(0);
  const [selectedScale, setSelectedScale] =
    useState<CircleScaleValue>("mode");
  const { radius, center } = useCircleDimensions();
  const { t } = useTranslation();

  const { circleOfFifths, modeTonic, scale, scaleLabel, triads, noteColors } =
    useMemo(
      () =>
        getCircleTheory({
          selectedRoot,
          selectedMode,
          selectedScale,
        }),
      [selectedRoot, selectedMode, selectedScale]
    );

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-950 p-4 text-white sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">
        🎵 Circle of Fifths
      </h1>

      <CircleDiagram
        center={center}
        circleOfFifths={circleOfFifths}
        modeTonic={modeTonic}
        noteColors={noteColors}
        onRootSelect={(note) => {
          setSelectedRoot(note);
          setSelectedMode(0);
        }}
        radius={radius}
        scale={scale}
        selectedRoot={selectedRoot}
        t={t}
      />

      <ModeControls
        onModeSelect={setSelectedMode}
        selectedMode={selectedMode}
      />

      <ScaleControls
        onScaleSelect={setSelectedScale}
        selectedScale={selectedScale}
      />

      <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 mt-6 sm:mt-8 w-full px-2 sm:px-4 max-w-5xl">
        <ScaleTriadsPanel
          modeTonic={modeTonic}
          scale={scale}
          scaleLabel={scaleLabel}
          t={t}
          triads={triads}
        />
        <LegendPanel />
      </div>
    </div>
  );
}

export default Circle;
