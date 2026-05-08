export type MusicXmlParseErrorReason =
  | "malformed-xml"
  | "missing-score-part";

const userMessages: Record<MusicXmlParseErrorReason, string> = {
  "malformed-xml": "That MusicXML file couldn't be parsed.",
  "missing-score-part": "That MusicXML file doesn't contain a score part.",
};

export class MusicXmlParseError extends Error {
  reason: MusicXmlParseErrorReason;
  details: string | null;
  userMessage: string;

  constructor(reason: MusicXmlParseErrorReason, details?: string) {
    const userMessage = userMessages[reason];
    super(details ? `${userMessage} ${details}` : userMessage);
    Object.setPrototypeOf(this, MusicXmlParseError.prototype);

    this.name = "MusicXmlParseError";
    this.reason = reason;
    this.details = details ?? null;
    this.userMessage = userMessage;
  }
}

type ParseMusicXmlDocumentOptions = {
  requireScorePart?: boolean;
};

const getParserError = (xmlDoc: XMLDocument) =>
  xmlDoc.getElementsByTagName("parsererror")[0] ??
  Array.from(xmlDoc.getElementsByTagNameNS("*", "parsererror"))[0] ??
  null;

const getParserErrorDetails = (parserError: Element) => {
  const details = parserError.textContent?.replace(/\s+/g, " ").trim();
  return details ? details.slice(0, 240) : undefined;
};

export const parseMusicXmlDocument = (
  xml: string,
  options: ParseMusicXmlDocumentOptions = {}
) => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = getParserError(xmlDoc);

  if (parserError) {
    throw new MusicXmlParseError(
      "malformed-xml",
      getParserErrorDetails(parserError)
    );
  }

  if (
    options.requireScorePart !== false &&
    !xmlDoc.getElementsByTagName("part")[0]
  ) {
    throw new MusicXmlParseError("missing-score-part");
  }

  return xmlDoc;
};

export const getMusicXmlParseErrorMessage = (error: unknown) =>
  error instanceof MusicXmlParseError ? error.userMessage : null;
