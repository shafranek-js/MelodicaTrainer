import { describe, expect, it } from "vitest";
import {
  resolveEffectiveInputSource,
  sanitizeInputMode,
} from "./inputMode";

describe("input mode", () => {
  it("uses MIDI in auto mode only while an input is connected", () => {
    expect(resolveEffectiveInputSource("auto", 0)).toBe("mic");
    expect(resolveEffectiveInputSource("auto", 1)).toBe("midi");
  });

  it("keeps explicit modes independent from connection state", () => {
    expect(resolveEffectiveInputSource("mic", 2)).toBe("mic");
    expect(resolveEffectiveInputSource("midi", 0)).toBe("midi");
  });

  it("sanitizes persisted values strictly", () => {
    expect(sanitizeInputMode("auto")).toBe("auto");
    expect(sanitizeInputMode("mic")).toBe("mic");
    expect(sanitizeInputMode("midi")).toBe("midi");
    expect(sanitizeInputMode("keyboard")).toBeUndefined();
    expect(sanitizeInputMode(null)).toBeUndefined();
  });
});
