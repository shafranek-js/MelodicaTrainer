import JSZip from "jszip";
import { parseMusicXmlDocument } from "./musicXmlParser";

export const getContainerScorePath = (containerXml: string) => {
  const xmlDoc = parseMusicXmlDocument(containerXml, {
    requireScorePart: false,
  });
  const rootFile = xmlDoc.getElementsByTagName("rootfile")[0];

  return rootFile?.getAttribute("full-path") || null;
};

const extractCompressedMusicXml = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerFile = zip.file("META-INF/container.xml");
  const containerScorePath = containerFile
    ? getContainerScorePath(await containerFile.async("text"))
    : null;
  const candidatePaths = [
    containerScorePath,
    ...Object.values(zip.files)
      .filter(
        (entry) =>
          !entry.dir &&
          /\.(musicxml|xml)$/i.test(entry.name) &&
          entry.name !== "META-INF/container.xml"
      )
      .map((entry) => entry.name),
  ].filter((path, index, paths): path is string =>
    Boolean(path && paths.indexOf(path) === index)
  );

  for (const path of candidatePaths) {
    const scoreFile = zip.file(path);
    if (scoreFile) return scoreFile.async("text");
  }

  throw new Error("No MusicXML score was found inside the MXL file.");
};

export const readMusicXmlFile = (file: File) => {
  const contentPromise = /\.mxl$/i.test(file.name)
    ? extractCompressedMusicXml(file)
    : file.text();

  return contentPromise.then((content) => {
    parseMusicXmlDocument(content);
    return content;
  });
};
