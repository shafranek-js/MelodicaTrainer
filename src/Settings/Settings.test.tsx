import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const library = vi.hoisted(() => ({
  chooseFolder: vi.fn(),
  directoryHandle: null as FileSystemDirectoryHandle | null,
  disconnect: vi.fn(),
  error: null as string | null,
  index: { entries: [] as unknown[], issues: [] as { message: string; relativePath: string; severity: "error" | "warning" }[], lastScanAt: null as string | null },
  isInitializing: false,
  isScanning: false,
  permission: "prompt" as string,
  reconnect: vi.fn(),
  rescan: vi.fn(),
  scanSummary: null as null | { added: number; errors: number; removed: number; skipped: number; updated: number; warnings: number },
  supported: true,
}));

vi.mock("../MusicXML/UserScoreLibraryContext", () => ({
  useUserScoreLibrary: () => library,
}));

import Settings from "./Settings";

const renderSettings = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<Settings />));
  return { container, root };
};

describe("Settings local library", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    library.directoryHandle = null;
    library.error = null;
    library.index = { entries: [], issues: [], lastScanAt: null };
    library.isInitializing = false;
    library.isScanning = false;
    library.permission = "prompt";
    library.scanSummary = null;
    library.supported = true;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("offers folder setup when no folder is configured", () => {
    const { container, root } = renderSettings();
    expect(container.textContent).toContain("Choose local library folder");
    act(() => root.unmount());
  });

  it("shows the browser fallback when folder access is unsupported", () => {
    library.supported = false;
    library.permission = "unsupported";
    const { container, root } = renderSettings();
    expect(container.textContent).toContain("Folder libraries are unavailable");
    expect(container.textContent).toContain("Load XML/GP/MIDI");
    act(() => root.unmount());
  });

  it("shows scan controls and counts for a connected folder", () => {
    library.directoryHandle = { name: "My Scores" } as FileSystemDirectoryHandle;
    library.permission = "granted";
    library.index = { entries: [{}, {}], issues: [], lastScanAt: "2026-07-18T10:00:00.000Z" };
    const { container, root } = renderSettings();
    expect(container.textContent).toContain("My Scores");
    expect(container.textContent).toContain("Connected");
    expect(container.textContent).toContain("Rescan");
    expect(container.textContent).toContain("Change folder");
    expect(container.textContent).toContain("Disconnect");
    act(() => root.unmount());
  });

  it("offers reconnection when permission is no longer granted", () => {
    library.directoryHandle = { name: "My Scores" } as FileSystemDirectoryHandle;
    library.permission = "prompt";
    const { container, root } = renderSettings();
    expect(container.textContent).toContain("Permission required");
    expect(container.textContent).toContain("Reconnect");
    act(() => root.unmount());
  });

  it("shows MSCZ conversion warnings separately from scan errors", () => {
    library.directoryHandle = { name: "My Scores" } as FileSystemDirectoryHandle;
    library.permission = "granted";
    library.scanSummary = { added: 1, errors: 0, removed: 0, skipped: 0, updated: 0, warnings: 1 };
    library.index = {
      entries: [{}],
      issues: [{
        message: "An unsupported decoration was skipped.",
        relativePath: "Tune.mscz",
        severity: "warning",
      }],
      lastScanAt: "2026-07-18T10:00:00.000Z",
    };

    const { container, root } = renderSettings();
    expect(container.textContent).toContain("1 warnings, 0 errors");
    expect(container.textContent).toContain("1 file notices");
    expect(container.textContent).toContain("Tune.mscz");
    act(() => root.unmount());
  });
});
