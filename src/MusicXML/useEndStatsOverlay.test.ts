import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  shouldShowEndStatsOverlay,
  useEndStatsOverlay,
} from "./useEndStatsOverlay";

describe("shouldShowEndStatsOverlay", () => {
  it("does not show on pause when completion id did not change", () => {
    expect(
      shouldShowEndStatsOverlay({
        lastShownCompletionId: 1,
        playbackCompletionId: 1,
      }),
    ).toBe(false);
  });

  it("shows when playback completion id increments", () => {
    expect(
      shouldShowEndStatsOverlay({
        lastShownCompletionId: 1,
        playbackCompletionId: 2,
      }),
    ).toBe(true);
  });

  it("shows when playback completion id increments even if the top drawer is visible", () => {
    expect(
      shouldShowEndStatsOverlay({
        lastShownCompletionId: 1,
        playbackCompletionId: 2,
      }),
    ).toBe(true);
  });

  it("does not show for the initial completion id", () => {
    expect(
      shouldShowEndStatsOverlay({
        lastShownCompletionId: 0,
        playbackCompletionId: 0,
      }),
    ).toBe(false);
  });

  it("dismisses the hook overlay on click", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    const Probe = ({
      playbackCompletionId,
    }: {
      playbackCompletionId: number;
    }) => {
      const { showEndStats } = useEndStatsOverlay({
        playbackCompletionId,
      });

      return createElement("div", {
        "data-visible": showEndStats ? "yes" : "no",
      });
    };

    await act(async () => {
      root.render(createElement(Probe, { playbackCompletionId: 0 }));
    });
    expect(container.firstElementChild?.getAttribute("data-visible")).toBe("no");

    await act(async () => {
      root.render(createElement(Probe, { playbackCompletionId: 1 }));
    });
    expect(container.firstElementChild?.getAttribute("data-visible")).toBe(
      "yes",
    );

    await act(async () => {
      window.dispatchEvent(new MouseEvent("click"));
    });
    expect(container.firstElementChild?.getAttribute("data-visible")).toBe("no");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
