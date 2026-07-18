import type {
  MidiKeySignature,
  MidiNoteData,
  MidiPartInfo,
  MidiTimeSignature,
  ParsedMidiScore,
} from "./midiParser";
import { Note } from "tonal";

export type MidiQuantizationMode =
  | "auto"
  | "eighth"
  | "sixteenth"
  | "thirty-second"
  | "triplets";

export type ResolvedMidiQuantization = Exclude<MidiQuantizationMode, "auto">;
export type MidiNotationStatus = "preparing" | "ready" | "unavailable";

export type MidiNotationResult = {
  cursorIndexByTick: Map<number, number>;
  cursorIndexByStartTick: Map<number, number>;
  musicXml: string;
  resolvedQuantization: ResolvedMidiQuantization;
  visualBoundaryTicks: number[];
  warnings: string[];
};

export const MIDI_NOTATION_DIVISIONS = 24;
export const MIDI_QUANTIZATION_OPTIONS: readonly {
  label: string;
  value: MidiQuantizationMode;
}[] = [
  { label: "Auto", value: "auto" },
  { label: "1/8", value: "eighth" },
  { label: "1/16", value: "sixteenth" },
  { label: "1/32", value: "thirty-second" },
  { label: "Triplets", value: "triplets" },
];

export const sanitizeMidiQuantizationMode = (
  value: unknown,
): MidiQuantizationMode | undefined =>
  MIDI_QUANTIZATION_OPTIONS.some((option) => option.value === value)
    ? value as MidiQuantizationMode
    : undefined;

type QuantizedNote = MidiNoteData & {
  endUnit: number;
  startUnit: number;
};

type QuantizationCandidate = {
  meanError: number;
  mode: ResolvedMidiQuantization;
  notes: QuantizedNote[];
  percentile95Error: number;
  symbolCount: number;
};

type NoteCluster = {
  endUnit: number;
  notes: QuantizedNote[];
  pitchCenter: number;
  startUnit: number;
};

type MeasureDefinition = {
  endUnit: number;
  index: number;
  key: MidiKeySignature;
  startUnit: number;
  time: MidiTimeSignature;
};

type DurationDefinition = {
  dots: number;
  duration: number;
  normalType?: string;
  type: string;
};

type VoiceItem = {
  duration: DurationDefinition;
  isMeasureRest?: boolean;
  midis: number[];
  startUnit: number;
  tieStart: boolean;
  tieStop: boolean;
};

type VoiceState = {
  assignments: number[];
  cost: number;
  endUnits: [number, number];
  lastClusterIndexes: [number | null, number | null];
  pitches: [number | null, number | null];
  ranges: [[number, number] | null, [number, number] | null];
};

const modeRank: Record<ResolvedMidiQuantization, number> = {
  eighth: 0,
  sixteenth: 1,
  triplets: 2,
  "thirty-second": 3,
};

const binaryStepByMode: Record<Exclude<ResolvedMidiQuantization, "triplets">, number> = {
  eighth: 12,
  sixteenth: 6,
  "thirty-second": 3,
};

const binaryDurations: DurationDefinition[] = [
  { dots: 0, duration: 96, type: "whole" },
  { dots: 1, duration: 72, type: "half" },
  { dots: 0, duration: 48, type: "half" },
  { dots: 1, duration: 36, type: "quarter" },
  { dots: 0, duration: 24, type: "quarter" },
  { dots: 1, duration: 18, type: "eighth" },
  { dots: 0, duration: 12, type: "eighth" },
  { dots: 1, duration: 9, type: "16th" },
  { dots: 0, duration: 6, type: "16th" },
  { dots: 0, duration: 3, type: "32nd" },
];

const tripletDurations: DurationDefinition[] = [
  { dots: 0, duration: 16, normalType: "quarter", type: "quarter" },
  { dots: 0, duration: 8, normalType: "eighth", type: "eighth" },
  { dots: 0, duration: 4, normalType: "16th", type: "16th" },
  { dots: 0, duration: 2, normalType: "32nd", type: "32nd" },
];

const getMinimumStep = (mode: ResolvedMidiQuantization) =>
  mode === "triplets" ? 2 : binaryStepByMode[mode];

const snapToStep = (value: number, step: number) => Math.round(value / step) * step;

const snapUnit = (value: number, mode: ResolvedMidiQuantization) => {
  if (mode !== "triplets") return snapToStep(value, binaryStepByMode[mode]);

  const candidates = [6, 8].flatMap((step) => {
    const lower = Math.floor(value / step) * step;
    return [lower, lower + step];
  });
  return candidates.reduce((best, candidate) => {
    const bestDistance = Math.abs(best - value);
    const distance = Math.abs(candidate - value);
    return distance < bestDistance || (distance === bestDistance && candidate < best)
      ? candidate
      : best;
  }, candidates[0]);
};

const getPercentile = (values: number[], percentile: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)];
};

const getDurationDefinitions = (allowTriplets: boolean) =>
  [...binaryDurations, ...(allowTriplets ? tripletDurations : [])]
    .sort((left, right) => right.duration - left.duration);

const decomposeDuration = (
  duration: number,
  allowTriplets: boolean,
  warnings?: Set<string>,
) => {
  const definitions = getDurationDefinitions(allowTriplets);
  const result: DurationDefinition[] = [];
  let remaining = Math.max(1, Math.round(duration));

  while (remaining > 0) {
    const definition = definitions.find((candidate) => candidate.duration <= remaining);
    if (!definition) {
      warnings?.add("Some very short durations were approximated.");
      result.push({ dots: 0, duration: remaining, type: "32nd" });
      break;
    }
    result.push(definition);
    remaining -= definition.duration;
  }
  return result;
};

const getClusteredStartTicks = (part: MidiPartInfo, ticksPerQuarter: number) => {
  const tolerance = Math.max(1, Math.floor(ticksPerQuarter / 64));
  const starts = new Map<MidiNoteData, number>();
  let anchor: number | null = null;

  [...part.notes]
    .sort((left, right) => left.startTick - right.startTick || left.midi - right.midi)
    .forEach((note) => {
      if (anchor === null || note.startTick - anchor > tolerance) anchor = note.startTick;
      starts.set(note, anchor);
    });
  return starts;
};

const createQuantizationCandidate = (
  part: MidiPartInfo,
  ticksPerQuarter: number,
  mode: ResolvedMidiQuantization,
): QuantizationCandidate => {
  const unitsPerTick = MIDI_NOTATION_DIVISIONS / ticksPerQuarter;
  const clusteredStarts = getClusteredStartTicks(part, ticksPerQuarter);
  const minimumStep = getMinimumStep(mode);
  const errors: number[] = [];
  const notes = part.notes.map((note): QuantizedNote => {
    const rawStartUnit = (clusteredStarts.get(note) ?? note.startTick) * unitsPerTick;
    const rawEndUnit = (note.startTick + note.durationTicks) * unitsPerTick;
    const startUnit = Math.max(0, snapUnit(rawStartUnit, mode));
    const endUnit = Math.max(startUnit + minimumStep, snapUnit(rawEndUnit, mode));
    errors.push(
      Math.abs(startUnit - rawStartUnit) / MIDI_NOTATION_DIVISIONS,
      Math.abs(endUnit - rawEndUnit) / MIDI_NOTATION_DIVISIONS,
    );
    return { ...note, endUnit, startUnit };
  });
  const definitions = notes.flatMap((note) => decomposeDuration(
    note.endUnit - note.startUnit,
    mode === "triplets",
  ));
  const tieCount = Math.max(0, definitions.length - notes.length);
  const tupletCount = definitions.filter((definition) => definition.normalType).length;
  const intervals = [...new Map(
    notes.map((note) => [
      `${note.startUnit}:${note.endUnit}`,
      { endUnit: note.endUnit, startUnit: note.startUnit },
    ]),
  ).values()].sort((left, right) => left.startUnit - right.startUnit);
  let coverageEnd = 0;
  let restCount = 0;
  intervals.forEach((interval) => {
    if (interval.startUnit > coverageEnd) {
      restCount += decomposeDuration(
        interval.startUnit - coverageEnd,
        mode === "triplets",
      ).length;
    }
    coverageEnd = Math.max(coverageEnd, interval.endUnit);
  });

  return {
    meanError: errors.reduce((sum, error) => sum + error, 0) / Math.max(1, errors.length),
    mode,
    notes,
    percentile95Error: getPercentile(errors, 0.95),
    symbolCount: definitions.length + restCount + tieCount + tupletCount,
  };
};

export const quantizeMidiPart = (
  part: MidiPartInfo,
  ticksPerQuarter: number,
  requestedMode: MidiQuantizationMode,
) => {
  const modes: ResolvedMidiQuantization[] = requestedMode === "auto"
    ? ["eighth", "sixteenth", "thirty-second", "triplets"]
    : [requestedMode];
  const candidates = modes.map((mode) =>
    createQuantizationCandidate(part, ticksPerQuarter, mode)
  );
  const acceptable = candidates.filter((candidate) => candidate.percentile95Error <= 0.04);
  const pool = acceptable.length > 0 ? acceptable : candidates;
  const sorted = [...pool].sort((left, right) => {
    if (acceptable.length === 0 && left.meanError !== right.meanError) {
      return left.meanError - right.meanError;
    }
    return left.symbolCount - right.symbolCount || modeRank[left.mode] - modeRank[right.mode];
  });
  return sorted[0];
};

const createClusters = (notes: QuantizedNote[]) => {
  const groups = new Map<number, QuantizedNote[]>();
  notes.forEach((note) => {
    const group = groups.get(note.startUnit) ?? [];
    group.push(note);
    groups.set(note.startUnit, group);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([startUnit, groupedNotes]): NoteCluster => ({
      endUnit: Math.max(...groupedNotes.map((note) => note.endUnit)),
      notes: groupedNotes.sort((left, right) => left.midi - right.midi),
      pitchCenter: groupedNotes.reduce((sum, note) => sum + note.midi, 0) / groupedNotes.length,
      startUnit,
    }));
};

const simplifyComplexOverlaps = (clusters: NoteCluster[], warnings: Set<string>) => {
  clusters.forEach((cluster, index) => {
    const active = clusters
      .slice(0, index)
      .filter((candidate) => candidate.endUnit > cluster.startUnit)
      .sort((left, right) => left.endUnit - right.endUnit);
    if (active.length < 2) return;
    active[0].endUnit = cluster.startUnit;
    warnings.add("Complex overlaps simplified.");
  });
};

const getTransitionCost = (previous: number | null, current: number) => {
  if (previous === null) return 0;
  const distance = Math.abs(current - previous);
  return distance * distance + 0.05 * distance;
};

const assignClustersToVoices = (clusters: NoteCluster[]) => {
  let states: VoiceState[] = [{
    assignments: [],
    cost: 0,
    endUnits: [0, 0],
    lastClusterIndexes: [null, null],
    pitches: [null, null],
    ranges: [null, null],
  }];

  clusters.forEach((cluster, clusterIndex) => {
    const nextStates: VoiceState[] = [];
    states.forEach((state) => {
      ([0, 1] as const).forEach((voice) => {
        const otherVoice = voice === 0 ? 1 : 0;
        if (state.endUnits[voice] > cluster.startUnit) return;

        const otherIsActive = state.endUnits[otherVoice] > cluster.startUnit;
        const otherRange = state.ranges[otherVoice];
        const clusterRange: [number, number] = [
          cluster.notes[0].midi,
          cluster.notes[cluster.notes.length - 1].midi,
        ];
        if (
          otherIsActive && otherRange !== null &&
          ((voice === 0 && clusterRange[0] < otherRange[1]) ||
            (voice === 1 && clusterRange[1] > otherRange[0]))
        ) {
          return;
        }

        const endUnits: [number, number] = [...state.endUnits];
        const pitches: [number | null, number | null] = [...state.pitches];
        const lastClusterIndexes: [number | null, number | null] = [...state.lastClusterIndexes];
        const ranges: [[number, number] | null, [number, number] | null] = [...state.ranges];
        endUnits[voice] = cluster.endUnit;
        pitches[voice] = cluster.pitchCenter;
        ranges[voice] = clusterRange;
        lastClusterIndexes[voice] = clusterIndex;
        nextStates.push({
          assignments: [...state.assignments, voice],
          cost: state.cost + getTransitionCost(state.pitches[voice], cluster.pitchCenter),
          endUnits,
          lastClusterIndexes,
          pitches,
          ranges,
        });
      });
    });

    states = nextStates
      .sort((left, right) => left.cost - right.cost)
      .slice(0, 64);
  });

  return states[0]?.assignments ?? clusters.map(() => 0);
};

const toUnit = (ticks: number, ticksPerQuarter: number) =>
  Math.round(ticks * MIDI_NOTATION_DIVISIONS / ticksPerQuarter);

const createMeasures = (
  score: ParsedMidiScore,
  maximumEndUnit: number,
  warnings: Set<string>,
) => {
  const timeChanges = score.timeSignatures.map((signature) => ({
    ...signature,
    unit: toUnit(signature.ticks, score.ticksPerQuarter),
  }));
  const keyChanges = score.keySignatures.map((signature) => ({
    ...signature,
    unit: toUnit(signature.ticks, score.ticksPerQuarter),
  }));
  const measures: MeasureDefinition[] = [];
  let cursor = 0;
  let activeTime = timeChanges[0] ?? { denominator: 4, numerator: 4, ticks: 0, unit: 0 };
  let activeKey = keyChanges[0] ?? { fifths: 0, mode: "major" as const, ticks: 0, unit: 0 };
  let timeIndex = activeTime.unit === 0 ? 1 : 0;
  let keyIndex = activeKey.unit === 0 ? 1 : 0;

  while (cursor < maximumEndUnit || measures.length === 0) {
    while (timeChanges[timeIndex]?.unit <= cursor) activeTime = timeChanges[timeIndex++];
    while (keyChanges[keyIndex]?.unit <= cursor) activeKey = keyChanges[keyIndex++];

    const measureLength = Math.max(
      1,
      Math.round(activeTime.numerator * MIDI_NOTATION_DIVISIONS * 4 / activeTime.denominator),
    );
    const endUnit = cursor + measureLength;
    if (timeChanges[timeIndex] && timeChanges[timeIndex].unit < endUnit) {
      warnings.add("A time signature change was moved to the next barline.");
      timeChanges[timeIndex].unit = endUnit;
    }
    if (keyChanges[keyIndex] && keyChanges[keyIndex].unit < endUnit) {
      warnings.add("A key signature change was moved to the next barline.");
      keyChanges[keyIndex].unit = endUnit;
    }

    measures.push({
      endUnit,
      index: measures.length,
      key: { fifths: activeKey.fifths, mode: activeKey.mode, ticks: activeKey.ticks },
      startUnit: cursor,
      time: {
        denominator: activeTime.denominator,
        numerator: activeTime.numerator,
        ticks: activeTime.ticks,
      },
    });
    cursor = endUnit;
  }
  return measures;
};

const getMeasureForUnit = (measures: MeasureDefinition[], unit: number) =>
  measures.find((measure) => unit >= measure.startUnit && unit < measure.endUnit) ??
  measures[measures.length - 1];

const buildVoiceItems = (
  clusters: NoteCluster[],
  assignments: number[],
  voice: number,
  measures: MeasureDefinition[],
  allowTriplets: boolean,
  warnings: Set<string>,
) => {
  const noteItemsByMeasure = new Map<number, VoiceItem[]>();
  clusters.forEach((cluster, clusterIndex) => {
    if (assignments[clusterIndex] !== voice) return;
    measures.forEach((measure) => {
      const segmentStart = Math.max(cluster.startUnit, measure.startUnit);
      const segmentEnd = Math.min(cluster.endUnit, measure.endUnit);
      if (segmentEnd <= segmentStart) return;
      let itemStart = segmentStart;
      const definitions = decomposeDuration(segmentEnd - segmentStart, allowTriplets, warnings);
      definitions.forEach((duration, durationIndex) => {
        const items = noteItemsByMeasure.get(measure.index) ?? [];
        items.push({
          duration,
          midis: cluster.notes.map((note) => note.midi),
          startUnit: itemStart,
          tieStart: segmentEnd < cluster.endUnit || durationIndex < definitions.length - 1,
          tieStop: segmentStart > cluster.startUnit || durationIndex > 0,
        });
        noteItemsByMeasure.set(measure.index, items);
        itemStart += duration.duration;
      });
    });
  });

  const result = new Map<number, VoiceItem[]>();
  measures.forEach((measure) => {
    const notes = (noteItemsByMeasure.get(measure.index) ?? [])
      .sort((left, right) => left.startUnit - right.startUnit);
    if (notes.length === 0) {
      result.set(measure.index, [{
        duration: {
          dots: 0,
          duration: measure.endUnit - measure.startUnit,
          type: "whole",
        },
        isMeasureRest: true,
        midis: [],
        startUnit: measure.startUnit,
        tieStart: false,
        tieStop: false,
      }]);
      return;
    }

    const items: VoiceItem[] = [];
    let cursor = measure.startUnit;
    notes.forEach((note) => {
      if (note.startUnit > cursor) {
        let restStart = cursor;
        decomposeDuration(note.startUnit - cursor, allowTriplets, warnings).forEach((duration) => {
          items.push({
            duration,
            midis: [],
            startUnit: restStart,
            tieStart: false,
            tieStop: false,
          });
          restStart += duration.duration;
        });
      }
      items.push(note);
      cursor = note.startUnit + note.duration.duration;
    });
    if (cursor < measure.endUnit) {
      let restStart = cursor;
      decomposeDuration(measure.endUnit - cursor, allowTriplets, warnings).forEach((duration) => {
        items.push({
          duration,
          midis: [],
          startUnit: restStart,
          tieStart: false,
          tieStop: false,
        });
        restStart += duration.duration;
      });
    }
    result.set(measure.index, items);
  });
  return result;
};

const appendElement = (
  xmlDoc: XMLDocument,
  parent: Node,
  tagName: string,
  text?: string,
) => {
  const element = xmlDoc.createElement(tagName);
  if (text !== undefined) element.textContent = text;
  parent.appendChild(element);
  return element;
};

const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const getPitch = (midi: number, fifths: number) => {
  const sharpName = Note.fromMidiSharps(midi);
  const name = fifths < 0
    ? `${flatNames[midi % 12]}${Note.octave(sharpName)}`
    : sharpName;
  const pitch = Note.get(name);
  return {
    alter: pitch.alt,
    octave: pitch.oct ?? 4,
    step: pitch.letter,
  };
};

const appendNotation = (
  xmlDoc: XMLDocument,
  measureElement: Element,
  item: VoiceItem,
  voice: number,
  key: MidiKeySignature,
) => {
  const appendOne = (midi: number | null, isChord: boolean) => {
    const noteElement = appendElement(xmlDoc, measureElement, "note");
    if (isChord) appendElement(xmlDoc, noteElement, "chord");
    if (midi === null) {
      const rest = appendElement(xmlDoc, noteElement, "rest");
      if (item.isMeasureRest) rest.setAttribute("measure", "yes");
    } else {
      const pitchElement = appendElement(xmlDoc, noteElement, "pitch");
      const pitch = getPitch(midi, key.fifths);
      appendElement(xmlDoc, pitchElement, "step", pitch.step);
      if (pitch.alter !== 0) appendElement(xmlDoc, pitchElement, "alter", String(pitch.alter));
      appendElement(xmlDoc, pitchElement, "octave", String(pitch.octave));
    }
    appendElement(xmlDoc, noteElement, "duration", String(item.duration.duration));
    if (item.tieStop && midi !== null) {
      const tie = appendElement(xmlDoc, noteElement, "tie");
      tie.setAttribute("type", "stop");
    }
    if (item.tieStart && midi !== null) {
      const tie = appendElement(xmlDoc, noteElement, "tie");
      tie.setAttribute("type", "start");
    }
    appendElement(xmlDoc, noteElement, "voice", String(voice + 1));
    appendElement(xmlDoc, noteElement, "type", item.duration.type);
    for (let dot = 0; dot < item.duration.dots; dot += 1) appendElement(xmlDoc, noteElement, "dot");
    if (item.duration.normalType) {
      const modification = appendElement(xmlDoc, noteElement, "time-modification");
      appendElement(xmlDoc, modification, "actual-notes", "3");
      appendElement(xmlDoc, modification, "normal-notes", "2");
      appendElement(xmlDoc, modification, "normal-type", item.duration.normalType);
    }
    if ((item.tieStart || item.tieStop) && midi !== null) {
      const notations = appendElement(xmlDoc, noteElement, "notations");
      if (item.tieStop) {
        const tied = appendElement(xmlDoc, notations, "tied");
        tied.setAttribute("type", "stop");
      }
      if (item.tieStart) {
        const tied = appendElement(xmlDoc, notations, "tied");
        tied.setAttribute("type", "start");
      }
    }
  };

  if (item.midis.length === 0) {
    appendOne(null, false);
  } else {
    item.midis.forEach((midi, index) => appendOne(midi, index > 0));
  }
};

const appendMeasureAttributes = (
  xmlDoc: XMLDocument,
  measureElement: Element,
  measure: MeasureDefinition,
  previous: MeasureDefinition | undefined,
) => {
  const timeChanged = !previous ||
    previous.time.numerator !== measure.time.numerator ||
    previous.time.denominator !== measure.time.denominator;
  const keyChanged = !previous ||
    previous.key.fifths !== measure.key.fifths ||
    previous.key.mode !== measure.key.mode;
  if (previous && !timeChanged && !keyChanged) return;

  const attributes = appendElement(xmlDoc, measureElement, "attributes");
  if (!previous) appendElement(xmlDoc, attributes, "divisions", String(MIDI_NOTATION_DIVISIONS));
  if (keyChanged) {
    const key = appendElement(xmlDoc, attributes, "key");
    appendElement(xmlDoc, key, "fifths", String(measure.key.fifths));
    appendElement(xmlDoc, key, "mode", measure.key.mode);
  }
  if (timeChanged) {
    const time = appendElement(xmlDoc, attributes, "time");
    appendElement(xmlDoc, time, "beats", String(measure.time.numerator));
    appendElement(xmlDoc, time, "beat-type", String(measure.time.denominator));
  }
  if (!previous) {
    appendElement(xmlDoc, attributes, "staves", "1");
    const clef = appendElement(xmlDoc, attributes, "clef");
    appendElement(xmlDoc, clef, "sign", "G");
    appendElement(xmlDoc, clef, "line", "2");
  }
};

const appendTempoDirections = (
  xmlDoc: XMLDocument,
  measureElement: Element,
  measure: MeasureDefinition,
  score: ParsedMidiScore,
) => {
  score.tempoChanges.forEach((tempo) => {
    const unit = toUnit(tempo.ticks, score.ticksPerQuarter);
    if (unit < measure.startUnit || unit >= measure.endUnit) return;
    const direction = appendElement(xmlDoc, measureElement, "direction");
    direction.setAttribute("placement", "above");
    const directionType = appendElement(xmlDoc, direction, "direction-type");
    const metronome = appendElement(xmlDoc, directionType, "metronome");
    appendElement(xmlDoc, metronome, "beat-unit", "quarter");
    appendElement(xmlDoc, metronome, "per-minute", String(Math.round(tempo.bpm)));
    const offset = Math.max(0, unit - measure.startUnit);
    if (offset > 0) appendElement(xmlDoc, direction, "offset", String(offset));
    const sound = appendElement(xmlDoc, direction, "sound");
    sound.setAttribute("tempo", String(tempo.bpm));
  });
};

const serializeMusicXml = (
  score: ParsedMidiScore,
  part: MidiPartInfo,
  measures: MeasureDefinition[],
  voiceItems: [Map<number, VoiceItem[]>, Map<number, VoiceItem[]>],
  usesSecondVoice: boolean,
) => {
  const xmlDoc = document.implementation.createDocument("", "score-partwise");
  const root = xmlDoc.documentElement;
  xmlDoc.insertBefore(
    xmlDoc.createProcessingInstruction(
      "xml",
      'version="1.0" encoding="UTF-8"',
    ),
    root,
  );
  root.setAttribute("version", "4.0");
  const work = appendElement(xmlDoc, root, "work");
  appendElement(xmlDoc, work, "work-title", score.fileName);
  const identification = appendElement(xmlDoc, root, "identification");
  const encoding = appendElement(xmlDoc, identification, "encoding");
  appendElement(xmlDoc, encoding, "software", "MelodicaTrainer MIDI Notation");
  const partList = appendElement(xmlDoc, root, "part-list");
  const scorePart = appendElement(xmlDoc, partList, "score-part");
  scorePart.setAttribute("id", "P1");
  appendElement(xmlDoc, scorePart, "part-name", `${part.name} — Ch. ${part.channel + 1}`);
  const partElement = appendElement(xmlDoc, root, "part");
  partElement.setAttribute("id", "P1");

  measures.forEach((measure, index) => {
    const measureElement = appendElement(xmlDoc, partElement, "measure");
    measureElement.setAttribute("number", String(index + 1));
    appendMeasureAttributes(xmlDoc, measureElement, measure, measures[index - 1]);
    appendTempoDirections(xmlDoc, measureElement, measure, score);
    (voiceItems[0].get(measure.index) ?? []).forEach((item) =>
      appendNotation(xmlDoc, measureElement, item, 0, measure.key)
    );
    if (usesSecondVoice) {
      const backup = appendElement(xmlDoc, measureElement, "backup");
      appendElement(xmlDoc, backup, "duration", String(measure.endUnit - measure.startUnit));
      (voiceItems[1].get(measure.index) ?? []).forEach((item) =>
        appendNotation(xmlDoc, measureElement, item, 1, measure.key)
      );
    }
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};

export const generateMidiNotation = (
  score: ParsedMidiScore,
  partId: string,
  requestedMode: MidiQuantizationMode,
): MidiNotationResult => {
  const part = score.parts.find((candidate) => candidate.id === partId);
  if (!part || part.notes.length === 0) throw new Error("MIDI part is missing.");
  if (!Number.isFinite(score.ticksPerQuarter) || score.ticksPerQuarter <= 0) {
    throw new Error("MIDI notation requires a valid PPQ time division.");
  }

  const warnings = new Set<string>();
  const quantized = quantizeMidiPart(part, score.ticksPerQuarter, requestedMode);
  const clusters = createClusters(quantized.notes);
  simplifyComplexOverlaps(clusters, warnings);
  const assignments = assignClustersToVoices(clusters);
  const maximumEndUnit = Math.max(...clusters.map((cluster) => cluster.endUnit));
  const measures = createMeasures(score, maximumEndUnit, warnings);
  const allowTriplets = quantized.mode === "triplets";
  const voiceItems: [Map<number, VoiceItem[]>, Map<number, VoiceItem[]>] = [
    buildVoiceItems(clusters, assignments, 0, measures, allowTriplets, warnings),
    buildVoiceItems(clusters, assignments, 1, measures, allowTriplets, warnings),
  ];
  const usesSecondVoice = assignments.includes(1);

  const positionIndexes = new Map<string, number>();
  const visualBoundaryUnits = new Set<number>();
  let nextCursorIndex = 0;
  measures.forEach((measure) => {
    const positions = new Set<number>();
    ([0, ...(usesSecondVoice ? [1] : [])]).forEach((voice) => {
      (voiceItems[voice as 0 | 1].get(measure.index) ?? []).forEach((item) => {
        positions.add(item.startUnit);
        visualBoundaryUnits.add(item.startUnit);
      });
    });
    [...positions].sort((left, right) => left - right).forEach((position) => {
      positionIndexes.set(`${measure.index}:${position}`, nextCursorIndex++);
    });
  });

  const cursorIndexByTick = new Map<number, number>();
  visualBoundaryUnits.forEach((unit) => {
    const measure = getMeasureForUnit(measures, unit);
    const index = positionIndexes.get(`${measure.index}:${unit}`);
    if (index === undefined) return;
    const tick = Math.max(
      0,
      Math.round(unit * score.ticksPerQuarter / MIDI_NOTATION_DIVISIONS),
    );
    cursorIndexByTick.set(tick, index);
  });

  const cursorIndexByStartTick = new Map<number, number>();
  quantized.notes.forEach((note) => {
    const measure = getMeasureForUnit(measures, note.startUnit);
    const index = positionIndexes.get(`${measure.index}:${note.startUnit}`);
    if (index !== undefined) {
      cursorIndexByStartTick.set(note.startTick, index);
      cursorIndexByTick.set(note.startTick, index);
    }
  });

  return {
    cursorIndexByTick,
    cursorIndexByStartTick,
    musicXml: serializeMusicXml(score, part, measures, voiceItems, usesSecondVoice),
    resolvedQuantization: quantized.mode,
    visualBoundaryTicks: [...visualBoundaryUnits]
      .sort((left, right) => left - right)
      .map((unit) => Math.max(0, Math.round(unit * score.ticksPerQuarter / MIDI_NOTATION_DIVISIONS))),
    warnings: [...warnings],
  };
};
