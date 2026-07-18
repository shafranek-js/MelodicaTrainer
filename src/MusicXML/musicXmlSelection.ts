export const getFirstPart = (xmlDoc: XMLDocument) =>
  xmlDoc.getElementsByTagName("part")[0] ?? null;

export const getFirstPartMeasures = (xmlDoc: XMLDocument) => {
  const firstPart = getFirstPart(xmlDoc);
  if (!firstPart) return [];

  return Array.from(firstPart.childNodes).filter(
    (child): child is Element =>
      child.nodeType === 1 && (child as Element).tagName === "measure"
  );
};

export const getNoteStaff = (note: Element) =>
  note.getElementsByTagName("staff")[0]?.textContent?.trim() || null;

export const getFirstStaffNumber = (part: Element) => {
  const firstStaffNote = Array.from(part.getElementsByTagName("note")).find(
    (note) => note.getElementsByTagName("staff")[0]
  );

  return firstStaffNote ? getNoteStaff(firstStaffNote) : null;
};

export const isFirstStaffNote = (
  note: Element,
  firstStaffNumber: string | null
) => {
  if (!firstStaffNumber) return true;

  return getNoteStaff(note) === firstStaffNumber;
};

export const isStaffNote = (
  note: Element,
  staffNumber: string | null,
) => !staffNumber || getNoteStaff(note) === staffNumber;

export const getFirstStaffNoteElements = (xmlDoc: XMLDocument) => {
  const firstPart = getFirstPart(xmlDoc);
  if (!firstPart) return [];

  const firstStaffNumber = getFirstStaffNumber(firstPart);

  return Array.from(firstPart.getElementsByTagName("note")).filter((note) =>
    isFirstStaffNote(note, firstStaffNumber)
  );
};

export const getStaffNoteElements = (
  xmlDoc: XMLDocument,
  staffNumber: string | null,
) => {
  const firstPart = getFirstPart(xmlDoc);
  if (!firstPart) return [];

  return Array.from(firstPart.getElementsByTagName("note")).filter((note) =>
    isStaffNote(note, staffNumber),
  );
};
