import { describe, expect, it } from "vitest";
import {
  configureSingleLineSheetWidth,
  getOsmdRenderedHeight,
  SINGLE_LINE_SHEET_MAX_WIDTH,
} from "./useOsmdScore";

describe("getOsmdRenderedHeight", () => {
  it("adds only a small safety margin to rendered notation", () => {
    const container = document.createElement("div");
    const emptySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    emptySvg.getBoundingClientRect = () => ({
      bottom: 400,
      height: 400,
      left: 0,
      right: 1000,
      toJSON: () => ({}),
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
    svg.getBoundingClientRect = () => ({
      bottom: 118,
      height: 110,
      left: 0,
      right: 800,
      toJSON: () => ({}),
      top: 8,
      width: 800,
      x: 0,
      y: 8,
    });
    container.append(emptySvg, svg);

    expect(getOsmdRenderedHeight(container)).toBe(118);
  });

  it("keeps a usable minimum while notation is being laid out", () => {
    expect(getOsmdRenderedHeight(document.createElement("div"))).toBe(96);
  });
});

describe("configureSingleLineSheetWidth", () => {
  it("raises OSMD's legacy SVG width cap so long scores cannot wrap", () => {
    const rules = { SheetMaximumWidth: 32_767 };

    configureSingleLineSheetWidth(rules);

    expect(rules.SheetMaximumWidth).toBe(SINGLE_LINE_SHEET_MAX_WIDTH);
    expect(rules.SheetMaximumWidth).toBeGreaterThan(32_767);
  });
});
