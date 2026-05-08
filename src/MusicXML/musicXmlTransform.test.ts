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
});
