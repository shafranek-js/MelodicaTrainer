import { describe, expect, it } from "vitest";
import {
  injectHarmonicaTabs,
  transposeKeySignatureFifths,
  transposeNoteName,
  writePitch,
} from "./musicXmlTransform";

const getFirstPitch = (xml: string) => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  return {
    pitch: xmlDoc.getElementsByTagName("pitch")[0],
    xmlDoc,
  };
};

describe("transposeNoteName", () => {
  it("transposes note names by semitone count", () => {
    expect(transposeNoteName("C4", 2)).toBe("D4");
    expect(transposeNoteName("C4", -1)).toBe("B3");
  });
});

describe("transposeKeySignatureFifths", () => {
  it("moves key signatures through the circle of fifths", () => {
    expect(transposeKeySignatureFifths(0, 2)).toBe(2);
    expect(transposeKeySignatureFifths(0, -3)).toBe(3);
  });
});

describe("writePitch", () => {
  it("updates pitch step, alter, and octave elements", () => {
    const { pitch, xmlDoc } = getFirstPitch(
      "<note><pitch><step>C</step><octave>4</octave></pitch></note>"
    );

    writePitch(xmlDoc, pitch, "F#5");

    expect(pitch.getElementsByTagName("step")[0].textContent).toBe("F");
    expect(pitch.getElementsByTagName("alter")[0].textContent).toBe("1");
    expect(pitch.getElementsByTagName("octave")[0].textContent).toBe("5");

    writePitch(xmlDoc, pitch, "G5");

    expect(pitch.getElementsByTagName("step")[0].textContent).toBe("G");
    expect(pitch.getElementsByTagName("alter")[0]).toBeUndefined();
  });
});

describe("injectHarmonicaTabs", () => {
  it("transposes key signatures and injects harmonica fingerings", () => {
    const output = injectHarmonicaTabs(
      `
        <score-partwise>
          <part>
            <measure>
              <attributes>
                <key><fifths>0</fifths></key>
              </attributes>
              <note default-y="10" relative-y="5">
                <pitch><step>C</step><octave>4</octave></pitch>
                <duration>1</duration>
              </note>
            </measure>
          </part>
        </score-partwise>
      `,
      { selectedKey: "C4", transpose: 0 }
    );
    const xmlDoc = new DOMParser().parseFromString(output, "application/xml");
    const note = xmlDoc.getElementsByTagName("note")[0];

    expect(xmlDoc.getElementsByTagName("fifths")[0].textContent).toBe("0");
    expect(note.getAttribute("default-y")).toBeNull();
    expect(note.getAttribute("relative-y")).toBeNull();
    expect(xmlDoc.getElementsByTagName("fingering")[0].textContent).toBe("1");
    expect(
      xmlDoc.getElementsByTagName("fingering")[0].getAttribute("placement")
    ).toBe("below");
  });

  it("only transposes and annotates the first staff from the first part", () => {
    const output = injectHarmonicaTabs(
      `
        <score-partwise>
          <part id="P1">
            <measure>
              <attributes>
                <key number="1"><fifths>0</fifths></key>
                <key number="2"><fifths>-1</fifths></key>
              </attributes>
              <note>
                <pitch><step>C</step><octave>4</octave></pitch>
                <duration>1</duration>
                <staff>1</staff>
              </note>
              <note>
                <pitch><step>G</step><octave>3</octave></pitch>
                <duration>1</duration>
                <staff>2</staff>
              </note>
            </measure>
          </part>
          <part id="P2">
            <measure>
              <attributes><key><fifths>2</fifths></key></attributes>
              <note>
                <pitch><step>D</step><octave>5</octave></pitch>
                <duration>1</duration>
              </note>
            </measure>
          </part>
        </score-partwise>
      `,
      { selectedKey: "C4", transpose: 2 }
    );
    const xmlDoc = new DOMParser().parseFromString(output, "application/xml");
    const notes = xmlDoc.getElementsByTagName("note");
    const keys = xmlDoc.getElementsByTagName("fifths");

    expect(notes[0].getElementsByTagName("step")[0].textContent).toBe("D");
    expect(notes[0].getElementsByTagName("fingering")[0].textContent).toBe("-1");
    expect(notes[1].getElementsByTagName("step")[0].textContent).toBe("G");
    expect(notes[1].getElementsByTagName("fingering")[0]).toBeUndefined();
    expect(notes[2].getElementsByTagName("step")[0].textContent).toBe("D");
    expect(notes[2].getElementsByTagName("fingering")[0]).toBeUndefined();
    expect(keys[0].textContent).toBe("2");
    expect(keys[1].textContent).toBe("-1");
    expect(keys[2].textContent).toBe("2");
  });

  it("reuses existing notations and keeps fingerings before lyrics", () => {
    const output = injectHarmonicaTabs(
      `
        <score-partwise>
          <part>
            <measure>
              <attributes><divisions>1</divisions></attributes>
              <note>
                <pitch><step>C</step><octave>4</octave></pitch>
                <duration>1</duration>
                <notations><tied type="start" /></notations>
              </note>
              <note>
                <pitch><step>D</step><octave>4</octave></pitch>
                <duration>1</duration>
                <lyric><text>la</text></lyric>
              </note>
            </measure>
          </part>
        </score-partwise>
      `,
      { selectedKey: "C4", transpose: 0 }
    );
    const xmlDoc = new DOMParser().parseFromString(output, "application/xml");
    const notes = xmlDoc.getElementsByTagName("note");

    expect(notes[0].getElementsByTagName("notations")).toHaveLength(1);
    expect(notes[0].getElementsByTagName("tied")[0]).toBeTruthy();
    expect(notes[0].getElementsByTagName("fingering")[0].textContent).toBe("1");

    const secondNoteChildren = Array.from(notes[1].children).map(
      (child) => child.tagName
    );
    expect(secondNoteChildren.indexOf("notations")).toBeLessThan(
      secondNoteChildren.indexOf("lyric")
    );
  });
});
