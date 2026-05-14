import { describe, expect, it } from "vitest";
import { getAutoFitZoom, isVisibleCanvasPixel } from "./alphaTabAutoFit";

describe("alphaTab auto-fit helpers", () => {
  it("ignores transparent and nearly white pixels", () => {
    expect(isVisibleCanvasPixel(new Uint8ClampedArray([0, 0, 0, 0]), 0)).toBe(false);
    expect(isVisibleCanvasPixel(new Uint8ClampedArray([250, 250, 250, 255]), 0)).toBe(false);
  });

  it("treats non-white opaque pixels as visible content", () => {
    expect(isVisibleCanvasPixel(new Uint8ClampedArray([10, 20, 30, 255]), 0)).toBe(true);
  });

  it("returns null when rendered height already fits", () => {
    expect(getAutoFitZoom(100, 95)).toBeNull();
  });

  it("returns a floored zoom when rendered height overflows", () => {
    expect(getAutoFitZoom(100, 200)).toBe(0.65);
    expect(getAutoFitZoom(180, 200)).toBe(0.86);
  });
});
