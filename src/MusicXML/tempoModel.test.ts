import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOMParser as XmldomParser } from "@xmldom/xmldom";
import type * as alphaTab from "@coderline/alphatab";
import { parseAlphaTabScore } from "./alphaTabParser";
import { parsePlaybackEvents } from "./playbackParser";
import {
  DEFAULT_TEMPO_BPM,
  getEffectiveTempoBpm,
  getResetTempoState,
  getTempoScale,
  sanitizeNullableTempo,
} from "./tempoModel";

const originalDomParser = globalThis.DOMParser;

beforeAll(() => {
  globalThis.DOMParser = XmldomParser as unknown as typeof DOMParser;
});

afterAll(() => {
  globalThis.DOMParser = originalDomParser;
});

describe("tempo model", () => {
  it("reads detected tempo from MusicXML", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <sound tempo="132" />
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.detectedTempo).toBe(132);
  });

  it("reads detected tempo from GP/alphaTab scores", () => {
    const score = {
      tempo: 200,
      midiTickResolution: 960,
      masterBars: [
        {
          start: 0,
          timeSignatureNumerator: 4,
          timeSignatureDenominator: 4,
          isRepeatStart: false,
          repeatCount: 0,
          tempoAutomations: [],
        },
      ],
      tracks: [
        {
          name: "Tempo Track",
          staves: [
            {
              bars: [
                {
                  voices: [
                    {
                      beats: [
                        {
                          playbackStart: 0,
                          playbackDuration: 960,
                          notes: [{ realValue: 60 }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as alphaTab.model.Score;

    expect(parseAlphaTabScore(score, "C").tempo).toBe(200);
  });

  it("uses manual tempo override over detected tempo", () => {
    expect(getEffectiveTempoBpm({ detectedTempoBpm: 200, userTempoBpm: null })).toBe(200);
    expect(getEffectiveTempoBpm({ detectedTempoBpm: 200, userTempoBpm: 90 })).toBe(90);
  });

  it("converts manual tempo to a playback scale relative to the detected tempo", () => {
    expect(getTempoScale({ detectedTempoBpm: 120, userTempoBpm: null })).toBe(1);
    expect(getTempoScale({ detectedTempoBpm: 120, userTempoBpm: 90 })).toBe(0.75);
    expect(getTempoScale({ detectedTempoBpm: 120, userTempoBpm: 180 })).toBe(1.5);
  });

  it("sanitizes persisted manual tempo values", () => {
    expect(sanitizeNullableTempo(null)).toBeNull();
    expect(sanitizeNullableTempo(10)).toBe(20);
    expect(sanitizeNullableTempo(999)).toBe(300);
    expect(sanitizeNullableTempo(Number.NaN)).toBeUndefined();
    expect(sanitizeNullableTempo("120")).toBeUndefined();
  });

  it("resets manual override and detected tempo when loading a new file", () => {
    expect(getResetTempoState()).toEqual({
      detectedTempoBpm: DEFAULT_TEMPO_BPM,
      userTempoBpm: null,
    });
  });
});
