import {
  getHarmonicaHoleForNote,
  getMelodicaKeyLabelForNote,
} from "../../utils/utils";
import type { MelodicaKeyCount } from "../../utils/utils";
import { getPitchNoteName } from "../playbackParser";
import { parseMusicXmlDocument } from "../musicXmlParser";
import {
  getFirstStaffNoteElements,
  getStaffNoteElements,
} from "../musicXmlSelection";
import {
  transposeKeySignatures,
  transposeNoteName,
  writePitch,
} from "./pitchTransform";
import { replaceFingeringText } from "./xmlDomHelpers";

type InjectHarmonicaTabsOptions = {
  selectedKey: string;
  transpose: number;
};

export const injectHarmonicaTabs = (
  xml: string,
  { selectedKey, transpose }: InjectHarmonicaTabsOptions,
): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
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
    replaceFingeringText(xmlDoc, note, tab);
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};

type InjectMelodicaLabelsOptions = {
  keyCount: MelodicaKeyCount;
  labelMode?: "note" | "keyNumber" | "none";
  staffNumber?: string | null;
  transpose: number;
};

export const injectMelodicaLabels = (
  xml: string,
  {
    keyCount,
    labelMode = "note",
    staffNumber,
    transpose,
  }: InjectMelodicaLabelsOptions,
): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const noteElements = staffNumber === undefined
    ? getFirstStaffNoteElements(xmlDoc)
    : getStaffNoteElements(xmlDoc, staffNumber);
  transposeKeySignatures(xmlDoc, transpose, staffNumber);

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

    const label = getMelodicaKeyLabelForNote(keyCount, transposedNote, labelMode);
    replaceFingeringText(xmlDoc, note, label);
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};
