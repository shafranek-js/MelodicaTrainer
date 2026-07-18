import { Note } from "tonal";
import { getFirstPart, getFirstStaffNumber } from "../musicXmlSelection";
import { upsertTextElement } from "./xmlDomHelpers";

const keySignatureTonicsByFifths = new Map(
  Array.from({ length: 15 }, (_, index) => {
    const fifths = index - 7;
    return [fifths, (fifths * 7 + 1200) % 12];
  }),
);

export const transposeNoteName = (
  noteName: string,
  semitones: number,
): string | null => {
  const midi = Note.midi(noteName);
  if (midi === null) return null;

  return Note.fromMidiSharps(midi + semitones);
};

export const writePitch = (
  xmlDoc: XMLDocument,
  pitch: Element,
  noteName: string,
) => {
  const note = Note.get(noteName);
  if (note.empty || note.oct === undefined) return;

  const octaveElement = upsertTextElement(
    xmlDoc,
    pitch,
    "octave",
    String(note.oct),
  );
  const existingAlter = pitch.getElementsByTagName("alter")[0];

  upsertTextElement(
    xmlDoc,
    pitch,
    "step",
    note.letter,
    existingAlter || octaveElement,
  );

  if (note.alt === 0) {
    existingAlter?.remove();
  } else if (existingAlter) {
    existingAlter.textContent = String(note.alt);
  } else {
    upsertTextElement(xmlDoc, pitch, "alter", String(note.alt), octaveElement);
  }
};

export const transposeKeySignatureFifths = (
  originalFifths: number,
  semitones: number,
) => {
  const originalChroma = keySignatureTonicsByFifths.get(originalFifths);
  if (originalChroma === undefined) return originalFifths;

  const targetChroma = (originalChroma + semitones + 1200) % 12;
  const candidates = Array.from(keySignatureTonicsByFifths.entries()).filter(
    ([, chroma]) => chroma === targetChroma,
  );

  return candidates.reduce(
    (best, [fifths]) => (Math.abs(fifths) < Math.abs(best) ? fifths : best),
    candidates[0]?.[0] ?? originalFifths,
  );
};

export const transposeKeySignatures = (
  xmlDoc: XMLDocument,
  semitones: number,
  selectedStaffNumber?: string | null,
) => {
  const firstPart = getFirstPart(xmlDoc);
  const firstStaffNumber = selectedStaffNumber ??
    (firstPart ? getFirstStaffNumber(firstPart) : null);
  const keyElements = firstPart
    ? Array.from(firstPart.getElementsByTagName("key"))
    : Array.from(xmlDoc.getElementsByTagName("key"));

  keyElements.forEach((key) => {
    const staffNumber = key.getAttribute("number");
    if (firstStaffNumber && staffNumber && staffNumber !== firstStaffNumber) {
      return;
    }

    const fifthsElement = key.getElementsByTagName("fifths")[0];
    if (!fifthsElement?.textContent) return;

    const fifths = Number(fifthsElement.textContent);
    if (!Number.isFinite(fifths)) return;

    fifthsElement.textContent = String(
      transposeKeySignatureFifths(fifths, semitones),
    );
  });
};
