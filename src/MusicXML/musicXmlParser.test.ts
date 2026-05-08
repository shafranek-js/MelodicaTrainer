import { describe, expect, it } from "vitest";
import {
  getMusicXmlParseErrorMessage,
  MusicXmlParseError,
  parseMusicXmlDocument,
} from "./musicXmlParser";

describe("parseMusicXmlDocument", () => {
  it("returns a MusicXML document when the score is valid", () => {
    const xmlDoc = parseMusicXmlDocument(`
      <score-partwise>
        <part>
          <measure />
        </part>
      </score-partwise>
    `);

    expect(xmlDoc.getElementsByTagName("part")).toHaveLength(1);
  });

  it("throws a structured error for malformed XML", () => {
    try {
      parseMusicXmlDocument("<score-partwise><part>");
    } catch (error) {
      if (!(error instanceof MusicXmlParseError)) throw error;

      expect(error.reason).toBe("malformed-xml");
      expect(error.userMessage).toBe("That MusicXML file couldn't be parsed.");
      expect(getMusicXmlParseErrorMessage(error)).toBe(error.userMessage);
      return;
    }

    throw new Error("Expected malformed XML to throw.");
  });

  it("throws a structured error when no score part exists", () => {
    try {
      parseMusicXmlDocument("<score-partwise />");
    } catch (error) {
      if (!(error instanceof MusicXmlParseError)) throw error;

      expect(error.reason).toBe("missing-score-part");
      expect(error.userMessage).toBe(
        "That MusicXML file doesn't contain a score part."
      );
      expect(getMusicXmlParseErrorMessage(error)).toBe(error.userMessage);
      return;
    }

    throw new Error("Expected missing score part to throw.");
  });

  it("can parse supporting XML documents without a score part", () => {
    const xmlDoc = parseMusicXmlDocument(
      '<container><rootfile full-path="score.musicxml" /></container>',
      { requireScorePart: false }
    );

    expect(xmlDoc.getElementsByTagName("rootfile")[0].getAttribute("full-path"))
      .toBe("score.musicxml");
  });
});
