export type RecordedMidiEvent = {
  channel: number;
  controller?: number;
  kind: "control-change" | "note-off" | "note-on" | "program-change";
  midi?: number;
  order: number;
  timeMs: number;
  value: number;
};

export type MidiRecording = {
  durationMs: number;
  events: RecordedMidiEvent[];
};

export type ActiveMidiSnapshot = {
  channel: number;
  count: number;
  midi: number;
  velocity: number;
};

export type MidiRecordingSnapshot = {
  activeNotes: ActiveMidiSnapshot[];
  banks: ReadonlyMap<number, number>;
  programs: ReadonlyMap<number, number>;
  volumes: ReadonlyMap<number, number>;
};

const clampMidiValue = (value: number) => Math.max(0, Math.min(127, Math.round(value)));
const activeKey = (channel: number, midi: number) => `${channel}:${midi}`;

export class MidiRecordingSession {
  private readonly activeCounts = new Map<string, number>();
  private readonly events: RecordedMidiEvent[] = [];
  private readonly now: () => number;
  private order = 0;
  private readonly startedAtMs: number;

  constructor(
    snapshot: MidiRecordingSnapshot,
    now: () => number = () => performance.now(),
  ) {
    this.now = now;
    this.startedAtMs = this.now();
    const channels = new Set([
      ...snapshot.banks.keys(),
      ...snapshot.programs.keys(),
      ...snapshot.volumes.keys(),
    ]);
    channels.forEach((channel) => {
      const bank = snapshot.banks.get(channel);
      if (bank !== undefined) this.recordControlChange(channel, 0, bank);
      const volume = snapshot.volumes.get(channel);
      if (volume !== undefined) this.recordControlChange(channel, 7, volume);
      const program = snapshot.programs.get(channel);
      if (program !== undefined) this.recordProgramChange(channel, program);
    });
    snapshot.activeNotes.forEach(({ channel, count, midi, velocity }) => {
      for (let index = 0; index < count; index += 1) {
        this.recordNoteOn(channel, midi, velocity);
      }
    });
  }

  private elapsedMs() {
    return Math.max(0, this.now() - this.startedAtMs);
  }

  private add(event: Omit<RecordedMidiEvent, "order" | "timeMs">) {
    this.events.push({
      ...event,
      order: this.order,
      timeMs: this.elapsedMs(),
    });
    this.order += 1;
  }

  recordControlChange(channel: number, controller: number, value: number) {
    this.add({
      channel: clampMidiValue(channel) & 0x0f,
      controller: clampMidiValue(controller),
      kind: "control-change",
      value: clampMidiValue(value),
    });
  }

  recordProgramChange(channel: number, program: number) {
    this.add({
      channel: clampMidiValue(channel) & 0x0f,
      kind: "program-change",
      value: clampMidiValue(program),
    });
  }

  recordNoteOn(channel: number, midi: number, velocity: number) {
    const safeChannel = clampMidiValue(channel) & 0x0f;
    const safeMidi = clampMidiValue(midi);
    const key = activeKey(safeChannel, safeMidi);
    this.activeCounts.set(key, (this.activeCounts.get(key) ?? 0) + 1);
    this.add({
      channel: safeChannel,
      kind: "note-on",
      midi: safeMidi,
      value: clampMidiValue(velocity),
    });
  }

  recordNoteOff(channel: number, midi: number) {
    const safeChannel = clampMidiValue(channel) & 0x0f;
    const safeMidi = clampMidiValue(midi);
    const key = activeKey(safeChannel, safeMidi);
    const nextCount = Math.max(0, (this.activeCounts.get(key) ?? 0) - 1);
    if (nextCount === 0) this.activeCounts.delete(key);
    else this.activeCounts.set(key, nextCount);
    this.add({
      channel: safeChannel,
      kind: "note-off",
      midi: safeMidi,
      value: 0,
    });
  }

  finish(): MidiRecording {
    for (const [key, count] of this.activeCounts) {
      const [channel, midi] = key.split(":").map(Number);
      for (let index = 0; index < count; index += 1) {
        this.recordNoteOff(channel, midi);
      }
    }
    this.activeCounts.clear();
    return {
      durationMs: this.elapsedMs(),
      events: [...this.events],
    };
  }
}

export const hasRecordedNotes = (recording: MidiRecording) =>
  recording.events.some((event) => event.kind === "note-on");

const encodeVariableLength = (value: number) => {
  let remaining = Math.max(0, Math.round(value));
  const bytes = [remaining & 0x7f];
  while ((remaining >>= 7) > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
  }
  return bytes;
};

const uint32Bytes = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const PPQ = 480;
const TICKS_PER_MS = PPQ / 500;

export const encodeMidiRecording = (recording: MidiRecording) => {
  const track: number[] = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20];
  const events = [...recording.events].sort(
    (a, b) => a.timeMs - b.timeMs || a.order - b.order,
  );
  let previousTick = 0;

  events.forEach((event) => {
    const tick = Math.max(previousTick, Math.round(event.timeMs * TICKS_PER_MS));
    track.push(...encodeVariableLength(tick - previousTick));
    previousTick = tick;
    if (event.kind === "note-on") {
      track.push(0x90 | event.channel, event.midi ?? 0, event.value);
    } else if (event.kind === "note-off") {
      track.push(0x80 | event.channel, event.midi ?? 0, 0);
    } else if (event.kind === "program-change") {
      track.push(0xc0 | event.channel, event.value);
    } else {
      track.push(0xb0 | event.channel, event.controller ?? 0, event.value);
    }
  });

  const endTick = Math.max(previousTick, Math.round(recording.durationMs * TICKS_PER_MS));
  track.push(...encodeVariableLength(endTick - previousTick), 0xff, 0x2f, 0x00);

  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (PPQ >>> 8) & 0xff, PPQ & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    ...uint32Bytes(track.length),
    ...track,
  ]);
};
