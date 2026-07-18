import { parseMusicXmlDocument } from "../musicXmlParser";
import {
  getFirstPart,
  getFirstPartMeasures,
  getFirstStaffNumber,
  isFirstStaffNote,
  isStaffNote,
} from "../musicXmlSelection";
import {
  getDirectChild,
  getDirectChildren,
  getFingeringText,
} from "./xmlDomHelpers";

export const exportMelodicaNotesText = (xml: string): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
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

export const createFirstStaffDisplayXml = (
  xml: string,
  selectedStaffNumber?: string | null,
): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const firstPart = getFirstPart(xmlDoc);
  if (!firstPart) return xml;

  const firstPartId = firstPart.getAttribute("id");
  let removedExtraPart = false;
  Array.from(xmlDoc.getElementsByTagName("score-part")).forEach((scorePart) => {
    if (firstPartId && scorePart.getAttribute("id") !== firstPartId) {
      scorePart.remove();
      removedExtraPart = true;
    }
  });

  Array.from(xmlDoc.getElementsByTagName("part")).forEach((part) => {
    if (part !== firstPart) {
      part.remove();
      removedExtraPart = true;
    }
  });

  // The practice view is intentionally compact. Keep musical notation and the
  // generated fingering labels, but omit score-layout text and print layout
  // directives. In particular, MusicXML exported from notation editors often
  // contains <print new-system="yes"> elements that would force OSMD to wrap
  // an otherwise horizontal practice staff. This only changes the XML copy
  // sent to OSMD; playback continues to use the unsimplified selected part.
  let removedDisplayText = false;
  ["direction", "harmony", "figured-bass", "print"].forEach((tagName) => {
    Array.from(firstPart.getElementsByTagName(tagName)).forEach((element) => {
      element.remove();
      removedDisplayText = true;
    });
  });
  Array.from(firstPart.getElementsByTagName("lyric")).forEach((lyric) => {
    lyric.remove();
    removedDisplayText = true;
  });

  const firstStaffNumber = selectedStaffNumber ?? getFirstStaffNumber(firstPart);
  if (!firstStaffNumber) {
    return removedExtraPart || removedDisplayText
      ? new XMLSerializer().serializeToString(xmlDoc)
      : xml;
  }

  getDirectChildren(firstPart, "measure").forEach((measure) => {
    Array.from(measure.children).forEach((child) => {
      if (child.tagName === "backup" || child.tagName === "forward") {
        child.remove();
        return;
      }

      if (child.tagName === "note") {
        if (!isStaffNote(child, firstStaffNumber)) {
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
      staves.remove(),
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
