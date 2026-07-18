import { describe, expect, it } from "vitest";
import { buildMusicXmlAccompaniment } from "./musicXmlAccompaniment";
import { selectMusicXmlPart } from "./musicXmlTransform";

const score = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
    <score-part id="P2"><part-name>Strings</part-name></score-part>
  </part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>
    <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><staff>1</staff></note>
    <backup><duration>1</duration></backup>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><staff>2</staff></note>
  </measure></part>
  <part id="P2"><measure number="1">
    <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
  </measure></part>
</score-partwise>`;

describe("MusicXML accompaniment extraction", () => {
  it("keeps the selected hand out of the background and includes other staves and parts", () => {
    const result = buildMusicXmlAccompaniment({
      primaryFileContent: selectMusicXmlPart(score, "P1"),
      rawFileContent: score,
      selectedPartId: "P1",
      selectedStaffId: "1",
      selectedStaffNumber: "1",
      transpose: 2,
    });

    expect(result.warnings).toEqual([]);
    expect(result.tracks.map((track) => track.id)).toEqual([
      "P1:2",
      "P2:implicit",
    ]);
    expect(result.tracks.map((track) => track.events[0].notes)).toEqual([[], []]);
    expect(result.tracks.map((track) =>
      track.events.flatMap((event) => event.notes.map((note) => note.name)),
    )).toEqual([["D3"], ["A4"]]);
  });
});
