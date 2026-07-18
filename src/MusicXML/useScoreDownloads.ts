import { useCallback } from "react";
import { exportMelodicaNotesText } from "./musicXmlTransform";

type DownloadFileOptions = {
  content: BlobPart;
  fileName: string;
  mimeType: string;
};

type UseScoreDownloadsOptions = {
  fileContent: string | null;
  fileName: string | null;
};

export const getTransposedXmlDownloadFileName = (fileName: string | null) =>
  fileName
    ? `transposed_${fileName.replace(/\.[^/.]+$/, "")}.musicxml`
    : "transposed.musicxml";

export const getMelodicaNotesDownloadFileName = (fileName: string | null) =>
  fileName ? `${fileName.replace(/\.[^/.]+$/, "")}_melodica_notes.txt` : "melodica_notes.txt";

export const downloadBrowserFile = ({
  content,
  fileName,
  mimeType,
}: DownloadFileOptions) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const useScoreDownloads = ({
  fileContent,
  fileName,
}: UseScoreDownloadsOptions) => {
  const downloadTransposedXml = useCallback(() => {
    if (!fileContent) return;

    downloadBrowserFile({
      content: fileContent,
      fileName: getTransposedXmlDownloadFileName(fileName),
      mimeType: "application/vnd.recordare.musicxml+xml",
    });
  }, [fileContent, fileName]);

  const downloadMelodicaNotes = useCallback(() => {
    if (!fileContent) return;

    downloadBrowserFile({
      content: exportMelodicaNotesText(fileContent),
      fileName: getMelodicaNotesDownloadFileName(fileName),
      mimeType: "text/plain",
    });
  }, [fileContent, fileName]);

  return { downloadMelodicaNotes, downloadTransposedXml };
};
