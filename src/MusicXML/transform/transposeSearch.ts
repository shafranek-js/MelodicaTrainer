import { Note } from "tonal";
import { generateLayout, generateMelodicaLayout } from "../../utils/utils";
import type { MelodicaKeyCount } from "../../utils/utils";
import { parseMusicXmlDocument } from "../musicXmlParser";
import { getFirstStaffNoteElements } from "../musicXmlSelection";
import { getPitchNoteName } from "../playbackParser";

type AutoTransposeOptions = {
  selectedKey: string;
  noOverblowOrDraw: boolean;
  noBend: boolean;
};

const createHarmonicaTabByMidi = (selectedKey: string) => {
  const layout = generateLayout(selectedKey);
  const tabByMidi = new Map<number, string>();
  const formatHole = (
    index: number,
    bend: number,
    isBlow: boolean,
    isOverdrawOrOverblow: boolean,
  ) => {
    const hole = isBlow ? index + 1 : -(index + 1);
    const apostrophes = `'`.repeat(bend);
    const overnote = isOverdrawOrOverblow ? "o" : "";
    return `${hole}${apostrophes}${overnote}`;
  };
  const put = (
    noteName: string | null,
    index: number,
    bend: number,
    isBlow: boolean,
    isOverdrawOrOverblow: boolean,
  ) => {
    if (!noteName) return;
    const midi = Note.midi(noteName);
    if (midi !== null && !tabByMidi.has(midi)) {
      tabByMidi.set(midi, formatHole(index, bend, isBlow, isOverdrawOrOverblow));
    }
  };

  for (let index = 0; index < 10; index += 1) {
    put(layout.blow[index]?.name ?? null, index, 0, true, false);
    put(layout.wholeStepBlowBend[index]?.name ?? null, index, 2, true, false);
    put(layout.HalfStepBlowBend[index]?.name ?? null, index, 1, true, false);
    put(layout.draw[index]?.name ?? null, index, 0, false, false);
    put(layout.halfStepDrawBendOverdraw[index]?.name ?? null, index, 1, false, false);
    put(layout.wholeStepDrawBend[index]?.name ?? null, index, 2, false, false);
    put(layout.oneAndHalfStepDrawBend[index]?.name ?? null, index, 3, false, false);
    put(layout.overblow[index]?.name ?? null, index, 0, true, true);
    put(layout.overdraw[index]?.name ?? null, index, 0, false, true);
  }

  return tabByMidi;
};

export const findBestTransposeIntervals = (
  midiNumbers: number[],
  { selectedKey, noOverblowOrDraw, noBend }: AutoTransposeOptions,
): number[] => {
  const uniqueMidi = Array.from(new Set(midiNumbers));
  if (uniqueMidi.length === 0) return [];

  const tabByMidi = createHarmonicaTabByMidi(selectedKey);
  const results: {
    interval: number;
    unplayableCount: number;
    forbiddenTechniqueCount: number;
  }[] = [];
  let minUnplayableCount = Number.POSITIVE_INFINITY;

  for (let interval = -36; interval <= 36; interval += 1) {
    let unplayableCount = 0;
    let forbiddenTechniqueCount = 0;

    for (const midi of uniqueMidi) {
      const transposedMidi = midi + interval;
      const tab = tabByMidi.get(transposedMidi);

      if (!tab) {
        unplayableCount += 1;
        continue;
      }

      if (noOverblowOrDraw && tab.toLowerCase().includes("o")) {
        forbiddenTechniqueCount += 1;
      }

      if (noBend && tab.includes("'")) {
        forbiddenTechniqueCount += 1;
      }
    }

    results.push({ interval, unplayableCount, forbiddenTechniqueCount });
    if (unplayableCount < minUnplayableCount) minUnplayableCount = unplayableCount;
  }

  const bestPlayableResults = results.filter(
    (result) => result.unplayableCount === minUnplayableCount,
  );
  const minForbiddenTechniqueCount = Math.min(
    ...bestPlayableResults.map((result) => result.forbiddenTechniqueCount),
  );

  return bestPlayableResults
    .filter((result) => result.forbiddenTechniqueCount === minForbiddenTechniqueCount)
    .map((result) => result.interval)
    .sort((a, b) => Math.abs(a) - Math.abs(b));
};

export const findBestTransposeInterval = (
  midiNumbers: number[],
  options: AutoTransposeOptions,
) => {
  const bests = findBestTransposeIntervals(midiNumbers, options);
  return bests.length > 0 ? bests[0] : null;
};

type AutoMelodicaTransposeOptions = {
  keyCount: MelodicaKeyCount;
};

export const findBestMelodicaTransposeIntervals = (
  midiNumbers: number[],
  { keyCount }: AutoMelodicaTransposeOptions,
): number[] => {
  const uniqueMidi = Array.from(new Set(midiNumbers));
  if (uniqueMidi.length === 0) return [];

  const layout = generateMelodicaLayout(keyCount);
  const minMidi = layout.keys[0]?.midi ?? 0;
  const maxMidi = layout.keys[layout.keys.length - 1]?.midi ?? 127;
  const results: { interval: number; unplayableCount: number }[] = [];
  let minUnplayableCount = Number.POSITIVE_INFINITY;

  for (let interval = -36; interval <= 36; interval += 1) {
    const unplayableCount = uniqueMidi.filter((midi) => {
      const transposedMidi = midi + interval;
      return transposedMidi < minMidi || transposedMidi > maxMidi;
    }).length;

    results.push({ interval, unplayableCount });
    if (unplayableCount < minUnplayableCount) minUnplayableCount = unplayableCount;
  }

  return results
    .filter((result) => result.unplayableCount === minUnplayableCount)
    .map((result) => result.interval)
    .sort((a, b) => Math.abs(a) - Math.abs(b));
};

export const findBestMelodicaTransposeInterval = (
  midiNumbers: number[],
  options: AutoMelodicaTransposeOptions,
) => {
  const bests = findBestMelodicaTransposeIntervals(midiNumbers, options);
  return bests.length > 0 ? bests[0] : null;
};

export const findAutoMelodicaTransposeIntervals = (
  xml: string,
  options: AutoMelodicaTransposeOptions,
) => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const noteElements = getFirstStaffNoteElements(xmlDoc);

  const midiNumbers: number[] = [];
  noteElements.forEach((note) => {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (!pitch) return;

    const name = getPitchNoteName(pitch);
    const midi = name ? Note.midi(name) : null;
    if (midi !== null) midiNumbers.push(midi);
  });

  return findBestMelodicaTransposeIntervals(midiNumbers, options);
};

export const findAutoMelodicaTransposeInterval = (
  xml: string,
  options: AutoMelodicaTransposeOptions,
) => {
  const bests = findAutoMelodicaTransposeIntervals(xml, options);
  return bests.length > 0 ? bests[0] : null;
};

export const findAutoTransposeIntervals = (
  xml: string,
  options: AutoTransposeOptions,
) => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const noteElements = getFirstStaffNoteElements(xmlDoc);

  const midiNumbers: number[] = [];
  noteElements.forEach((note) => {
    const pitch = note.getElementsByTagName("pitch")[0];
    if (pitch) {
      const name = getPitchNoteName(pitch);
      const midi = name ? Note.midi(name) : null;
      if (midi !== null) midiNumbers.push(midi);
    }
  });

  return findBestTransposeIntervals(midiNumbers, options);
};

export const findAutoTransposeInterval = (
  xml: string,
  options: AutoTransposeOptions,
) => {
  const bests = findAutoTransposeIntervals(xml, options);
  return bests.length > 0 ? bests[0] : null;
};
