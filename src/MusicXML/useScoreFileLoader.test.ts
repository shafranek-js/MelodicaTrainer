import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import { decodePersistentValue, encodePersistentValue } from "../hooks/usePersistentState";
import { shouldReplacePersistedDefaultScore, useScoreFileLoader } from "./useScoreFileLoader";
import type { LoadedScoreFile } from "./useScoreFileLoader";
import { getScoreFormat } from "./scoreFormat";

class BinaryTestFile extends File {
  private readonly testBuffer: ArrayBuffer;

  constructor(bytes: Uint8Array, name: string) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    super([buffer], name);
    this.testBuffer = buffer;
  }

  override async arrayBuffer() {
    return this.testBuffer.slice(0);
  }
}

beforeEach(() => localStorage.clear());

describe("score file loader defaults", () => {
  it("replaces persisted legacy default scores", () => {
    expect(shouldReplacePersistedDefaultScore("<score />", "IntroSong.musicxml")).toBe(true);
    expect(shouldReplacePersistedDefaultScore(new Uint8Array([1]), "IntroSong-notebender.musicxml")).toBe(true);
  });

  it("preserves user-loaded scores", () => {
    expect(shouldReplacePersistedDefaultScore("<score />", "My Song.musicxml")).toBe(false);
    expect(shouldReplacePersistedDefaultScore(new Uint8Array([1]), "custom.gp")).toBe(false);
  });

  it("loads the default when no score is persisted", () => {
    expect(shouldReplacePersistedDefaultScore(null, null)).toBe(false);
  });

  it("persists converted MSCZ content, source format, and warnings", async () => {
    localStorage.setItem(
      "melodicatrainer_raw_content",
      encodePersistentValue("<score-partwise><part id=\"P1\" /></score-partwise>"),
    );
    localStorage.setItem(
      "melodicatrainer_file_name",
      encodePersistentValue("existing.musicxml"),
    );
    const zip = new JSZip();
    zip.file("Warning.mscx", `
      <museScore version="4.60"><Score><Division>480</Division><Staff id="1"><Measure><voice>
        <Chord><durationType>quarter</durationType><Note><pitch>60</pitch></Note></Chord>
        <UnsupportedDecoration />
      </voice></Measure></Staff></Score></museScore>`);
    const file = new BinaryTestFile(
      await zip.generateAsync({ type: "uint8array" }),
      "Warning.mscz",
    );
    const container = document.createElement("div");
    const root = createRoot(container);
    let loader: ReturnType<typeof useScoreFileLoader> | null = null;

    const Harness = () => {
      loader = useScoreFileLoader({ onDefaultLoadError: () => undefined });
      return null;
    };
    act(() => root.render(createElement(Harness)));

    let loaded: Awaited<ReturnType<ReturnType<typeof useScoreFileLoader>["loadScoreFile"]>> | null = null;
    const currentLoader = loader as unknown as ReturnType<typeof useScoreFileLoader>;
    await act(async () => {
      loaded = await currentLoader.loadScoreFile(file);
    });

    const committed = loaded as unknown as LoadedScoreFile;
    expect(committed).toMatchObject({
      fileName: "Warning.mscz",
      format: "musicxml",
      sourceFormat: "musescore",
    });
    expect(committed.warnings.length).toBeGreaterThan(0);
    expect((loader as unknown as ReturnType<typeof useScoreFileLoader>).scoreFormat).toBe("musicxml");
    expect((loader as unknown as ReturnType<typeof useScoreFileLoader>).sourceFormat).toBe("musescore");
    act(() => root.unmount());

    expect(decodePersistentValue(
      localStorage.getItem("melodicatrainer_score_conversion_warnings") ?? "",
    )).toEqual(committed.warnings);
    expect(decodePersistentValue(
      localStorage.getItem("melodicatrainer_raw_content") ?? "",
    )).toContain("<score-partwise");
  });
});

describe("score format detection", () => {
  it("recognizes supported score formats", () => {
    expect(getScoreFormat("score.musicxml")).toBe("musicxml");
    expect(getScoreFormat("score.GP5")).toBe("guitar-pro");
    expect(getScoreFormat("score.mid")).toBe("midi");
    expect(getScoreFormat("score.MIDI")).toBe("midi");
    expect(getScoreFormat("score.MSCZ")).toBe("musicxml");
  });

  it("rejects unsupported extensions", () => {
    expect(getScoreFormat("score.kar")).toBeNull();
    expect(getScoreFormat("score.pdf")).toBeNull();
  });
});
