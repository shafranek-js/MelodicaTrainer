import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { melodicaRangeOptions } from "../utils/utils";

vi.mock("./ScoreLibraryDialog", () => ({ ScoreLibraryDialog: () => null }));

import { ScoreSettingsPanel } from "./ScoreSettingsPanel";

const makeProps = (): ComponentProps<typeof ScoreSettingsPanel> => ({
  accompanimentChannelOverflow: false,
  accompanimentTrackCount: 0,
  accompanimentVolume: 10,
  accompanimentWarnings: [],
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
  musicXmlParts: [],
  musicXmlStaves: [],
  midiQuantizationMode: "auto",
  onDownloadMelodicaNotes: vi.fn(),
  onDownloadTransposedXml: vi.fn(),
  onFileChange: vi.fn(),
  onAccompanimentVolumeChange: vi.fn(),
  onGpTrackChange: vi.fn(),
  onLibraryScoreLoad: vi.fn(),
  onMelodicaRangeChange: vi.fn(),
  onMidiPartChange: vi.fn(),
  onMusicXmlPartChange: vi.fn(),
  onMusicXmlStaffChange: vi.fn(),
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
  selectedMusicXmlPartId: null,
  selectedMusicXmlStaffId: null,
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

describe("ScoreSettingsPanel parts", () => {
  it("lets the user choose a part in a multi-part score", async () => {
    const props = makeProps();
    props.canTryHighFidelityMscz = false;
    props.scoreFormat = "musicxml";
    props.musicXmlParts = [
      { id: "P1", name: "Voice" },
      { id: "P2", name: "Piano" },
    ];
    props.selectedMusicXmlPartId = "P1";
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Part"]',
    );
    expect(select?.value).toBe("P1");
    expect(Array.from(select?.options ?? []).map((option) => option.text)).toEqual([
      "Voice",
      "Piano",
    ]);

    await act(async () => {
      if (!select) return;
      select.value = "P2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(props.onMusicXmlPartChange).toHaveBeenCalledWith("P2");
    act(() => root.unmount());
  });

  it("lets the user choose a piano hand", async () => {
    const props = makeProps();
    props.canTryHighFidelityMscz = false;
    props.scoreFormat = "musicxml";
    props.musicXmlParts = [{ id: "P1", name: "Piano" }];
    props.selectedMusicXmlPartId = "P1";
    props.musicXmlStaves = [
      { id: "1", name: "Right hand" },
      { id: "2", name: "Left hand" },
    ];
    props.selectedMusicXmlStaffId = "1";
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Hand"]',
    );
    expect(Array.from(select?.options ?? []).map((option) => option.text)).toEqual([
      "Right hand",
      "Left hand",
    ]);
    await act(async () => {
      if (!select) return;
      select.value = "2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(props.onMusicXmlStaffChange).toHaveBeenCalledWith("2");
    act(() => root.unmount());
  });

  it.each([
    {
      configure: (props: ReturnType<typeof makeProps>) => {
        props.scoreFormat = "guitar-pro";
        props.gpTracks = [{ index: 0, name: "Guitar" }];
      },
      option: "Guitar",
      type: "GP",
    },
    {
      configure: (props: ReturnType<typeof makeProps>) => {
        props.scoreFormat = "midi";
        props.midiParts = [{
          channel: 0,
          durationSeconds: 1,
          id: "channel-0",
          name: "Piano",
          noteCount: 1,
          notes: [],
          originalMidiNumbers: [60],
        }];
        props.selectedMidiPartId = "channel-0";
      },
      option: "Piano — Ch. 1",
      type: "MIDI",
    },
  ])("uses the same Part selector for $type", async ({ configure, option }) => {
    const props = makeProps();
    props.canTryHighFidelityMscz = false;
    configure(props);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Part"]',
    );
    expect(select).not.toBeNull();
    expect(select?.selectedOptions[0].text).toBe(option);
    act(() => root.unmount());
  });
});

describe("ScoreSettingsPanel accompaniment", () => {
  it("shows a persistent-style group volume only when hidden parts exist", async () => {
    const props = makeProps();
    props.accompanimentTrackCount = 2;
    props.accompanimentVolume = 10;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ScoreSettingsPanel {...props} />
        </MemoryRouter>,
      );
    });

    const slider = container.querySelector<HTMLInputElement>(
      'input[aria-label="Background accompaniment volume"]',
    );
    expect(slider?.value).toBe("10");
    expect(container.textContent).toContain("2 hidden parts");

    await act(async () => {
      if (!slider) return;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(slider, "0");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onAccompanimentVolumeChange).toHaveBeenCalledWith(0);
    act(() => root.unmount());
  });

  it("hides accompaniment controls for a single-part score", async () => {
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

    expect(container.querySelector(
      'input[aria-label="Background accompaniment volume"]',
    )).toBeNull();
    act(() => root.unmount());
  });
});
