import { describe, expect, it, vi } from "vitest";
import { MAX_MUSIC_XML_FILE_BYTES } from "./musicXmlFile";
import type { ScoreLibraryEntry } from "./scoreLibrary";
import {
  downloadScoreLibraryFile,
  getScoreLibraryDownloadErrorMessage,
  ScoreLibraryDownloadError,
} from "./scoreLibraryDownload";

const entry: ScoreLibraryEntry = {
  id: "test-score",
  title: "Test Score",
  composer: "Test Composer",
  fileName: "Test_Score.mxl",
  tags: ["test"],
};

const expectDownloadError = async (
  promise: Promise<unknown>,
  reason: ScoreLibraryDownloadError["reason"],
) => {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof ScoreLibraryDownloadError)) throw error;
    expect(error.reason).toBe(reason);
    expect(getScoreLibraryDownloadErrorMessage(error)).toBe(error.userMessage);
    return;
  }
  throw new Error(`Expected ${reason} to throw.`);
};

describe("downloadScoreLibraryFile", () => {
  it("downloads a library score as a File", async () => {
    const response = {
      blob: vi.fn().mockResolvedValue(
        new Blob(["score"], { type: "application/vnd.recordare.musicxml" }),
      ),
      headers: new Headers({ "content-length": "5" }),
      ok: true,
    } as Pick<Response, "blob" | "headers" | "ok"> as Response;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    const file = await downloadScoreLibraryFile(entry, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://musetrainer.github.io/library/scores/Test_Score.mxl",
      { signal: undefined },
    );
    expect(file.name).toBe(entry.fileName);
    expect(file.size).toBe(5);
  });

  it("rejects unsupported file formats before fetching", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expectDownloadError(
      downloadScoreLibraryFile({ ...entry, fileName: "score.pdf" }, { fetchImpl }),
      "unsupported-format",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects paths that escape the approved score directory", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expectDownloadError(
      downloadScoreLibraryFile(
        { ...entry, fileName: "../outside-library.mxl" },
        { fetchImpl },
      ),
      "invalid-source",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unsuccessful HTTP responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expectDownloadError(
      downloadScoreLibraryFile(entry, { fetchImpl }),
      "http-error",
    );
  });

  it("rejects oversized downloads using the response header", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        headers: { "content-length": String(MAX_MUSIC_XML_FILE_BYTES + 1) },
        status: 200,
      }),
    );

    await expectDownloadError(
      downloadScoreLibraryFile(entry, { fetchImpl }),
      "file-too-large",
    );
  });

  it("rejects oversized downloads when the response omits its size", async () => {
    const response = {
      blob: vi.fn().mockResolvedValue({
        size: MAX_MUSIC_XML_FILE_BYTES + 1,
        type: "application/vnd.recordare.musicxml",
      }),
      headers: new Headers(),
      ok: true,
    } as Pick<Response, "blob" | "headers" | "ok"> as Response;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expectDownloadError(
      downloadScoreLibraryFile(entry, { fetchImpl }),
      "file-too-large",
    );
  });

  it("maps network and cancellation failures", async () => {
    const networkFetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    await expectDownloadError(
      downloadScoreLibraryFile(entry, { fetchImpl: networkFetch }),
      "network-error",
    );

    const controller = new AbortController();
    controller.abort();
    const cancelledFetch = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException("aborted", "AbortError"),
    );
    await expectDownloadError(
      downloadScoreLibraryFile(entry, {
        fetchImpl: cancelledFetch,
        signal: controller.signal,
      }),
      "cancelled",
    );
  });
});
