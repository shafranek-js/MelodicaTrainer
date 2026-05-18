export type FingerAssignment = {
  eventIndex: number;
  noteIndex: number;
  finger: number; // 1–5
};

export type NoteInfo = {
  eventIndex: number;
  noteIndex: number;
  midi: number;
  whitePos: number;
  isBlack: boolean;
};

export type NoteGroup = NoteInfo[];

export type Candidate = {
  fingers: number[];
  handPos: number;
  cost: number;
};

export type GroupDpState = {
  cost: number;
  prevCandidate: number;
  candidate: Candidate;
};
