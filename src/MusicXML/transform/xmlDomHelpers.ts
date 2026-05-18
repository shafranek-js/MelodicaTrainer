export const upsertTextElement = (
  xmlDoc: XMLDocument,
  parent: Element,
  tagName: string,
  text: string,
  before?: Element,
) => {
  let element = parent.getElementsByTagName(tagName)[0];

  if (!element) {
    element = xmlDoc.createElement(tagName);
    parent.insertBefore(element, before || null);
  }

  element.textContent = text;
  return element;
};

export const getDirectChild = (parent: Element, tagName: string) =>
  Array.from(parent.children).find((child) => child.tagName === tagName);

export const getDirectChildren = (parent: Element, tagName: string) =>
  Array.from(parent.children).filter((child) => child.tagName === tagName);

const getNotationInsertBefore = (note: Element) =>
  Array.from(note.children).find((child) =>
    ["lyric", "play", "listen"].includes(child.tagName),
  );

export const replaceFingeringText = (
  xmlDoc: XMLDocument,
  note: Element,
  text: string | null,
) => {
  const notations = getDirectChildren(note, "notations");

  notations.forEach((notation) => {
    Array.from(notation.getElementsByTagName("fingering")).forEach(
      (fingering) => fingering.remove(),
    );
  });

  if (!text) return;

  let notation = notations[0];
  if (!notation) {
    notation = xmlDoc.createElement("notations");
    note.insertBefore(notation, getNotationInsertBefore(note) || null);
  }

  let technical = getDirectChild(notation, "technical");
  if (!technical) {
    technical = xmlDoc.createElement("technical");
    notation.appendChild(technical);
  }

  const fingering = xmlDoc.createElement("fingering");
  fingering.setAttribute("placement", "below");
  fingering.textContent = text;
  technical.appendChild(fingering);
};

export const getFingeringText = (note: Element) =>
  note.getElementsByTagName("fingering")[0]?.textContent?.trim() || "";
