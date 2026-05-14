import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOMParser as XmldomParser } from "@xmldom/xmldom";
import type * as alphaTab from "@coderline/alphatab";
import { parseAlphaTabScore } from "./alphaTabParser";
import { parsePlaybackEvents } from "./playbackParser";

const originalDomParser = globalThis.DOMParser;

beforeAll(() => {
    globalThis.DOMParser = XmldomParser as unknown as typeof DOMParser;
});

afterAll(() => {
    globalThis.DOMParser = originalDomParser;
});

describe("score parser smoke tests without browser DOM", () => {
    it("parses a minimal MusicXML melody in node", () => {
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
        `, { addLeadIn: false });

        expect(result.detectedTempo).toBe(132);
        expect(result.events[0].notes[0]?.name).toBe("C4");
    });

    it("parses a minimal GP/alphaTab score model in node", () => {
        const score = {
            tempo: 144,
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
                    name: "Smoke Track",
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

        const result = parseAlphaTabScore(score, "C", 0, 0, { addLeadIn: false });

        expect(result.tempo).toBe(144);
        expect(result.events[0].notes[0]?.name).toBe("C4");
    });
});
