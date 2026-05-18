import { parseMusicXmlDocument } from "../musicXmlParser";
import {
  getFirstPart,
  getFirstPartMeasures,
  getFirstStaffNumber,
  isFirstStaffNote,
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

export const createFirstStaffDisplayXml = (xml: string): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
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
