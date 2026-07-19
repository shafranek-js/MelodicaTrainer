import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { generateMelodicaLayout } from "../utils/utils";
import { MelodicaKeyboard } from "./MelodicaKeyboard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pointerEvent = (type: string, pointerId = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
  });
  return event;
};

describe("MelodicaKeyboard interaction", () => {
  it("balances pointer and keyboard note events without bubbling clicks", async () => {
    const container = document.createElement("div");
    const parentClick = vi.fn();
    const root = createRoot(container);
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();

    await act(async () => {
      root.render(createElement(
        "div",
        { onClick: parentClick },
        createElement(MelodicaKeyboard, {
          formatPitchClass: (pitchClass) => pitchClass,
          layout: generateMelodicaLayout(32),
          onNoteOff,
          onNoteOn,
        }),
      ));
    });

    const keyboard = container.querySelector<HTMLElement>('[role="group"]');
    const key = container.querySelector<HTMLElement>('[role="button"]');
    expect(keyboard?.className).toContain("pointer-events-auto");
    expect(key?.tabIndex).toBe(0);

    await act(async () => key?.dispatchEvent(pointerEvent("pointerdown")));
    await act(async () => key?.dispatchEvent(pointerEvent("pointerup")));
    expect(onNoteOn).toHaveBeenCalledTimes(1);
    expect(onNoteOff).toHaveBeenCalledTimes(1);

    await act(async () => key?.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: " ",
    })));
    await act(async () => key?.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      key: " ",
    })));
    expect(onNoteOn).toHaveBeenCalledTimes(2);
    expect(onNoteOff).toHaveBeenCalledTimes(2);

    key?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(parentClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("releases a held pointer note on unmount", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onNoteOff = vi.fn();

    await act(async () => {
      root.render(createElement(MelodicaKeyboard, {
        formatPitchClass: (pitchClass) => pitchClass,
        layout: generateMelodicaLayout(32),
        onNoteOff,
        onNoteOn: vi.fn(),
      }));
    });
    const key = container.querySelector<HTMLElement>('[role="button"]');
    await act(async () => key?.dispatchEvent(pointerEvent("pointerdown")));
    act(() => root.unmount());
    expect(onNoteOff).toHaveBeenCalledOnce();
  });

  it("restarts the playback strike overlay for the same key", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const layout = generateMelodicaLayout(32);
    await act(async () => root.render(createElement(MelodicaKeyboard, {
      formatPitchClass: (pitchClass) => pitchClass,
      getKeyState: (key) => key.midi === 60 ? { playbackPulseId: 1 } : {},
      layout,
    })));
    expect(container.querySelector('[data-playback-pulse="1"]')).not.toBeNull();
    await act(async () => root.render(createElement(MelodicaKeyboard, {
      formatPitchClass: (pitchClass) => pitchClass,
      getKeyState: (key) => key.midi === 60 ? { playbackPulseId: 2 } : {},
      layout,
    })));
    expect(container.querySelector('[data-playback-pulse="1"]')).toBeNull();
    expect(container.querySelector('[data-playback-pulse="2"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
