import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { melodicaRangeOptions } from "../utils/utils";

vi.mock("./ScoreLibraryDialog", () => ({ ScoreLibraryDialog: () => null }));

import { ScoreSettingsPanel } from "./ScoreSettingsPanel";

const makeProps = (): ComponentProps<typeof ScoreSettingsPanel> => ({
  availablePresets: [],
  canTryHighFidelityMscz: true,
  canUseProcessedScore: false,
  conversionWarnings: [],
  fileName: null,
  gpTracks: [],
  isPinned: false,
  isTryingHighFidelityMscz: false,
  keyCount: 32,
  melodicaRanges: melodicaRangeOptions,
  midiNotationStatus: "preparing",
  midiNotationWarnings: [],
  midiParts: [],
  midiQuantizationMode: "auto",
  onDownloadMelodicaNotes: vi.fn(),
  onDownloadTransposedXml: vi.fn(),
  onFileChange: vi.fn(),
  onGpTrackChange: vi.fn(),
  onLibraryScoreLoad: vi.fn(),
  onMelodicaRangeChange: vi.fn(),
  onMidiPartChange: vi.fn(),
  onMidiQuantizationChange: vi.fn(),
  onSelectedPresetChange: vi.fn(),
  onSoundFontChange: vi.fn(),
  onTogglePin: vi.fn(),
  onTryHighFidelityMscz: vi.fn(),
  resolvedMidiQuantization: null,
  routeStatus: null,
  routeStatusClassNames: {
    error: "error",
    info: "info",
    success: "success",
  },
  scoreFormat: null,
  selectedGpTrackIndex: 0,
  selectedMidiPartId: null,
  selectedPreset: "0:0",
  selectedSoundFont: "melodica.sf2",
  soundFonts: [{ label: "Melodica", value: "melodica.sf2" }],
});

describe("ScoreSettingsPanel MSCZ fallback", () => {
  it("shows the opt-in local conversion action after a blocked standard import", async () => {
    const props = makeProps();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("standard MSCZ converter could not safely open");
    expect(container.textContent).toContain("optional ~18 MB MuseScore engine");
    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Try high-fidelity conversion"),
    );
    await act(async () => { button?.click(); });
    expect(props.onTryHighFidelityMscz).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("offers the same action when the standard conversion reports warnings", async () => {
    const props = makeProps();
    props.conversionWarnings = ["Some notation was simplified."];
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("MSCZ converted with possible notation loss");
    expect(container.textContent).toContain("Try high-fidelity conversion");
    act(() => root.unmount());
  });
});
