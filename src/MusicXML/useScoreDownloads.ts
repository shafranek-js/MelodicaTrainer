import { useCallback } from "react";
import { exportHarpTabsText } from "./musicXmlTransform";

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
  fileName ? `transposed_${fileName}` : "transposed.musicxml";

export const getHarpTabsDownloadFileName = (fileName: string | null) =>
  fileName ? `${fileName.replace(/\.[^/.]+$/, "")}_tabs.txt` : "tabs.txt";

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

  const downloadHarpTabs = useCallback(() => {
    if (!fileContent) return;

    downloadBrowserFile({
      content: exportHarpTabsText(fileContent),
      fileName: getHarpTabsDownloadFileName(fileName),
      mimeType: "text/plain",
    });
  }, [fileContent, fileName]);

  return { downloadHarpTabs, downloadTransposedXml };
};
