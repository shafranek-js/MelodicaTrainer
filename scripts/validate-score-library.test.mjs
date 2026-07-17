import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertAssetIntegrity,
  assertCatalogMetadata,
  parseMusicXml,
} from "./validate-score-library.mjs";

const xml = Buffer.from(`<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><staff>1</staff></note></measure></part></score-partwise>`);
const entry = {
  id: "test",
  title: "Test",
  composer: "Test",
  format: "musicxml",
  assetPath: "assets/test/test.musicxml",
  fileName: "test.musicxml",
  bytes: xml.length,
  sha256: createHash("sha256").update(xml).digest("hex"),
  difficulty: "beginner",
  tags: [],
  source: { name: "Test", url: "https://example.com" },
  license: { kind: "CC0-1.0", url: "https://example.com/cc0", basis: "test" },
  rightsReviewedAt: "2026-07-17",
};

describe("score library validator", () => {
  it("rejects invalid schema and duplicate IDs", () => {
    expect(() => assertCatalogMetadata({ catalogVersion: 0, entries: [] })).toThrow("catalogVersion");
    expect(() => assertCatalogMetadata({ catalogVersion: 1, entries: [entry, entry] })).toThrow("duplicate id");
  });

  it("rejects an incorrect size or SHA-256", () => {
    expect(() => assertAssetIntegrity({ ...entry, bytes: entry.bytes + 1 }, xml)).toThrow("bytes mismatch");
    expect(() => assertAssetIntegrity({ ...entry, sha256: "0".repeat(64) }, xml)).toThrow("SHA-256 mismatch");
  });

  it("accepts playable XML and rejects a damaged MXL", async () => {
    await expect(parseMusicXml(entry, xml)).resolves.toMatchObject({ notes: 1 });
    await expect(parseMusicXml({ ...entry, fileName: "test.mxl" }, Buffer.from("not a zip"))).rejects.toThrow("damaged MXL");
  });
});
