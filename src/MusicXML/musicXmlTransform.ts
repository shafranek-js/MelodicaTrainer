import { Note } from "tonal";
import { getHarmonicaHoleForNote } from "../utils/utils";
import { getPitchNoteName } from "./playbackParser";
import {
  getFirstPart,
  getFirstPartMeasures,
  getFirstStaffNoteElements,
  getFirstStaffNumber,
  isFirstStaffNote,
} from "./musicXmlSelection";

const keySignatureTonicsByFifths = new Map(
  Array.from({ length: 15 }, (_, index) => {
    const fifths = index - 7;
    return [fifths, (fifths * 7 + 1200) % 12];
  })
);

export const transposeNoteName = (
  noteName: string,
  semitones: number
): string | null => {
  const midi = Note.midi(noteName);
  if (midi === null) return null;

  return Note.fromMidiSharps(midi + semitones);
};

const upsertTextElement = (
  xmlDoc: XMLDocument,
  parent: Element,
  tagName: string,
  text: string,
  before?: Element
) => {
  let element = parent.getElementsByTagName(tagName)[0];

  if (!element) {
    element = xmlDoc.createElement(tagName);
    parent.insertBefore(element, before || null);
  }

  element.textContent = text;
  return element;
};

const getDirectChild = (parent: Element, tagName: string) =>
  Array.from(parent.children).find((child) => child.tagName === tagName);

const getDirectChildren = (parent: Element, tagName: string) =>
  Array.from(parent.children).filter((child) => child.tagName === tagName);

const getNotationInsertBefore = (note: Element) =>
  Array.from(note.children).find((child) =>
    ["lyric", "play", "listen"].includes(child.tagName)
  );

const replaceHarmonicaFingering = (
  xmlDoc: XMLDocument,
  note: Element,
  tab: string | null
) => {
  const notations = getDirectChildren(note, "notations");

  notations.forEach((notation) => {
    Array.from(notation.getElementsByTagName("fingering")).forEach(
      (fingering) => fingering.remove()
    );
  });

  if (!tab) return;

  let notation = notations[0];
  if (!notation) {
    notation = xmlDoc.createElement("notations");
    note.insertBefore(notation, getNotationInsertBefore(note) || null);
  }

  let technical = getDirectChild(notation, "technical");
  if (!technical) {
    technical = xmlDoc.createElement("technical");
    notation.appendChild(technical);
  }

  const fingering = xmlDoc.createElement("fingering");
  fingering.setAttribute("placement", "below");
  fingering.textContent = tab;
  technical.appendChild(fingering);
};

const getFingeringText = (note: Element) =>
  note.getElementsByTagName("fingering")[0]?.textContent?.trim() || "";

export const exportHarpTabsText = (xml: string): string => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const firstPart = getFirstPart(xmlDoc);
  const firstStaffNumber = firstPart ? getFirstStaffNumber(firstPart) : null;

  return getFirstPartMeasures(xmlDoc)
    .map((measure) => {
      const tokens: string[] = [];

      getDirectChildren(measure, "note").forEach((note) => {
        if (!isFirstStaffNote(note, firstStaffNumber)) return;

        const tab = getFingeringText(note);
        if (!tab) return;

        const isChord = Boolean(getDirectChild(note, "chord"));
        if (isChord && tokens.length) {
          tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}/${tab}`;
          return;
        }

        tokens.push(tab);
      });

      return tokens.join(" ");
    })
    .filter(Boolean)
    .join("\n");
};

export const createFirstStaffDisplayXml = (xml: string): string => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const firstPart = getFirstPart(xmlDoc);
  if (!firstPart) return xml;

  const firstStaffNumber = getFirstStaffNumber(firstPart);
  if (!firstStaffNumber) return xml;

  const firstPartId = firstPart.getAttribute("id");
  Array.from(xmlDoc.getElementsByTagName("score-part")).forEach((scorePart) => {
    if (firstPartId && scorePart.getAttribute("id") !== firstPartId) {
      scorePart.remove();
    }
  });

  Array.from(xmlDoc.getElementsByTagName("part")).forEach((part) => {
    if (part !== firstPart) part.remove();
  });

  getDirectChildren(firstPart, "measure").forEach((measure) => {
    Array.from(measure.children).forEach((child) => {
      if (child.tagName === "backup" || child.tagName === "forward") {
        child.remove();
        return;
      }

      if (child.tagName === "note") {
        if (!isFirstStaffNote(child, firstStaffNumber)) {
          child.remove();
          return;
        }

        getDirectChild(child, "staff")?.remove();
        return;
      }

      const staff = getDirectChild(child, "staff");
      if (!staff) return;

      if (staff.textContent?.trim() !== firstStaffNumber) {
        child.remove();
        return;
      }
      staff.remove();
    });

    Array.from(measure.getElementsByTagName("staves")).forEach((staves) =>
      staves.remove()
    );
    Array.from(measure.querySelectorAll("[number]")).forEach((element) => {
      const number = element.getAttribute("number");
      if (!number) return;

      if (["clef", "key", "time", "staff-details"].includes(element.tagName)) {
        if (number !== firstStaffNumber) {
          element.remove();
        } else {
          element.removeAttribute("number");
        }
      }

      if (element.tagName === "staff-layout") {
        element.remove();
      }
    });
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};

export const writePitch = (
  xmlDoc: XMLDocument,
  pitch: Element,
  noteName: string
) => {
  const note = Note.get(noteName);
  if (note.empty || note.oct === undefined) return;

  const octaveElement = upsertTextElement(
    xmlDoc,
    pitch,
    "octave",
    String(note.oct)
  );
  const existingAlter = pitch.getElementsByTagName("alter")[0];

  upsertTextElement(
    xmlDoc,
    pitch,
    "step",
    note.letter,
    existingAlter || octaveElement
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
  semitones: number
) => {
  const originalChroma = keySignatureTonicsByFifths.get(originalFifths);
  if (originalChroma === undefined) return originalFifths;

  const targetChroma = (originalChroma + semitones + 1200) % 12;
  const candidates = Array.from(keySignatureTonicsByFifths.entries()).filter(
    ([, chroma]) => chroma === targetChroma
  );

  return candidates.reduce(
    (best, [fifths]) => (Math.abs(fifths) < Math.abs(best) ? fifths : best),
    candidates[0]?.[0] ?? originalFifths
  );
};

export const transposeKeySignatures = (
  xmlDoc: XMLDocument,
  semitones: number
) => {
  const firstPart = getFirstPart(xmlDoc);
  const firstStaffNumber = firstPart ? getFirstStaffNumber(firstPart) : null;
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
      transposeKeySignatureFifths(fifths, semitones)
    );
  });
};

type InjectHarmonicaTabsOptions = {
  selectedKey: string;
  transpose: number;
};

export const injectHarmonicaTabs = (
  xml: string,
  { selectedKey, transpose }: InjectHarmonicaTabsOptions
): string => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");
  const noteElements = getFirstStaffNoteElements(xmlDoc);
  transposeKeySignatures(xmlDoc, transpose);

  noteElements.forEach((note) => {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (!pitch) return;

    const originalNote = getPitchNoteName(pitch);
    if (!originalNote) return;

    const transposedNote = transposeNoteName(originalNote, transpose);
    if (!transposedNote) return;

    writePitch(xmlDoc, pitch, transposedNote);
    note.removeAttribute("default-y");
    note.removeAttribute("relative-y");

    const tab = getHarmonicaHoleForNote(selectedKey, transposedNote);
    replaceHarmonicaFingering(xmlDoc, note, tab);
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};

type AutoTransposeOptions = {
  selectedKey: string;
  noOverblowOrDraw: boolean;
  noBend: boolean;
};

export const findAutoTransposeInterval = (
  xml: string,
  { selectedKey, noOverblowOrDraw, noBend }: AutoTransposeOptions
) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");
  const noteElements = getFirstStaffNoteElements(xmlDoc);

  for (let interval = -36; interval <= 36; interval += 1) {
    let hasInvalidNotes = false;

    for (const note of noteElements) {
      const pitch = note.getElementsByTagName("pitch")[0];
      if (!pitch) continue;

      const originalNote = getPitchNoteName(pitch);
      if (!originalNote) continue;

      const transposed = transposeNoteName(originalNote, interval);
      if (!transposed) continue;

      const tab = getHarmonicaHoleForNote(selectedKey, transposed);

      if (!tab) {
        hasInvalidNotes = true;
        break;
      }

      if (noOverblowOrDraw && tab.endsWith("o")) {
        hasInvalidNotes = true;
        break;
      }

      if (noBend && tab.endsWith("'")) {
        hasInvalidNotes = true;
        break;
      }
    }

    if (!hasInvalidNotes) return interval;
  }

  return null;
};
