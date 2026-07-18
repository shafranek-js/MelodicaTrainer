import { parseMusicXmlDocument } from "../musicXmlParser";

export type MusicXmlPartInfo = {
  id: string;
  name: string;
};

export type MusicXmlStaffInfo = {
  id: string;
  name: string;
};

const getPartKey = (part: Element, index: number) =>
  part.getAttribute("id")?.trim() || `part-${index + 1}`;

const getPartName = (
  scorePart: Element | undefined,
  index: number,
): string => {
  const partName = scorePart?.getElementsByTagName("part-name")[0]
    ?.textContent?.trim();
  const abbreviation = scorePart?.getElementsByTagName("part-abbreviation")[0]
    ?.textContent?.trim();
  return partName || abbreviation || `Part ${index + 1}`;
};

export const getMusicXmlParts = (xml: string): MusicXmlPartInfo[] => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const scorePartsById = new Map(
    Array.from(xmlDoc.getElementsByTagName("score-part")).map((scorePart) => [
      scorePart.getAttribute("id")?.trim() || "",
      scorePart,
    ]),
  );

  const parts = Array.from(xmlDoc.getElementsByTagName("part")).map((part, index) => {
    const sourceId = part.getAttribute("id")?.trim() || "";
    return {
      id: getPartKey(part, index),
      name: getPartName(scorePartsById.get(sourceId), index),
    };
  });

  const nameCounts = new Map<string, number>();
  parts.forEach((part) => {
    nameCounts.set(part.name, (nameCounts.get(part.name) ?? 0) + 1);
  });
  const nameOccurrences = new Map<string, number>();
  return parts.map((part) => {
    if ((nameCounts.get(part.name) ?? 0) < 2) return part;
    const occurrence = (nameOccurrences.get(part.name) ?? 0) + 1;
    nameOccurrences.set(part.name, occurrence);
    return { ...part, name: `${part.name} (${occurrence})` };
  });
};

export const selectMusicXmlPart = (xml: string, partId: string): string => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const parts = Array.from(xmlDoc.getElementsByTagName("part"));
  const selectedIndex = parts.findIndex(
    (part, index) => getPartKey(part, index) === partId,
  );
  if (selectedIndex < 0) return xml;

  const selectedPart = parts[selectedIndex];
  const selectedSourceId = selectedPart.getAttribute("id")?.trim() || "";

  parts.forEach((part) => {
    if (part !== selectedPart) part.remove();
  });
  Array.from(xmlDoc.getElementsByTagName("score-part")).forEach((scorePart) => {
    if (
      selectedSourceId &&
      scorePart.getAttribute("id")?.trim() !== selectedSourceId
    ) {
      scorePart.remove();
    }
  });

  return new XMLSerializer().serializeToString(xmlDoc);
};

export const getMusicXmlStaves = (xml: string): MusicXmlStaffInfo[] => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const part = xmlDoc.getElementsByTagName("part")[0];
  if (!part) return [];

  const staffIds = Array.from(part.getElementsByTagName("note"))
    .map((note) => note.getElementsByTagName("staff")[0]?.textContent?.trim())
    .filter((staffId): staffId is string => Boolean(staffId))
    .filter((staffId, index, values) => values.indexOf(staffId) === index);

  if (staffIds.length === 0) {
    return [{ id: "implicit", name: "Staff" }];
  }

  const partId = part.getAttribute("id")?.trim() || "";
  const scorePart = Array.from(xmlDoc.getElementsByTagName("score-part"))
    .find((candidate) => candidate.getAttribute("id")?.trim() === partId);
  const partName = getPartName(scorePart, 0);
  const isKeyboardPart = /piano|keyboard|klavier|grand staff/i.test(partName);

  return staffIds.map((staffId, index) => ({
    id: staffId,
    name: isKeyboardPart && staffIds.length === 2
      ? index === 0 ? "Right hand" : "Left hand"
      : `Staff ${staffId}`,
  }));
};
