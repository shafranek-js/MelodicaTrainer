import {
  getMusicXmlParts,
  getMusicXmlStaves,
  selectMusicXmlPart,
} from "./musicXmlTransform";
import { parsePlaybackEvents } from "./playbackParser";
import {
  alignAccompanimentLeadIn,
  transposePlaybackEvents,
  type AccompanimentTrack,
} from "./accompaniment";

type BuildMusicXmlAccompanimentOptions = {
  primaryFileContent: string;
  rawFileContent: string;
  selectedPartId: string;
  selectedStaffId: string;
  selectedStaffNumber: string | null;
  transpose: number;
};

export const buildMusicXmlAccompaniment = ({
  primaryFileContent,
  rawFileContent,
  selectedPartId,
  selectedStaffId,
  selectedStaffNumber,
  transpose,
}: BuildMusicXmlAccompanimentOptions): {
  tracks: AccompanimentTrack[];
  warnings: string[];
} => {
  const warnings: string[] = [];
  const tracks: AccompanimentTrack[] = [];

  getMusicXmlParts(rawFileContent).forEach((part) => {
    try {
      const partXml = selectMusicXmlPart(rawFileContent, part.id);
      const staves = getMusicXmlStaves(partXml);
      staves.forEach((staff) => {
        if (part.id === selectedPartId && staff.id === selectedStaffId) return;

        try {
          const staffNumber = staff.id === "implicit" ? null : staff.id;
          const parsed = parsePlaybackEvents(partXml, {
            addLeadIn: false,
            staffNumber,
          });
          const events = transposePlaybackEvents(parsed.events, transpose);
          if (!events.some((event) => event.notes.length > 0)) return;

          tracks.push({
            events,
            id: `${part.id}:${staff.id}`,
            label: staves.length > 1
              ? `${part.name} — ${staff.name}`
              : part.name,
          });
        } catch {
          warnings.push(`${part.name} — ${staff.name}`);
        }
      });
    } catch {
      warnings.push(part.name);
    }
  });

  try {
    const primaryWithLeadIn = parsePlaybackEvents(primaryFileContent, {
      staffNumber: selectedStaffNumber,
    }).events;
    const primaryWithoutLeadIn = parsePlaybackEvents(primaryFileContent, {
      addLeadIn: false,
      staffNumber: selectedStaffNumber,
    }).events;
    return {
      tracks: alignAccompanimentLeadIn(
        primaryWithLeadIn,
        primaryWithoutLeadIn,
        tracks,
      ),
      warnings,
    };
  } catch {
    return { tracks, warnings };
  }
};
