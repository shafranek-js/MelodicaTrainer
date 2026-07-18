import type { MsczConversionResult } from "./msczFile";
import {
  MsczFileError,
  validateMsczArchiveForConversion,
  validateMsczConversionOutput,
} from "./msczFile";

export const HIGH_FIDELITY_MSCZ_WARNING =
  "Converted with the optional MuseScore 4.0 compatibility engine. Review the score before practice because this engine cannot report partial notation loss.";

type WebMscoreScore = {
  destroy: (soft?: boolean) => void;
  saveXml: () => Promise<string>;
};

type WebMscoreConstructor = {
  load: (
    format: "mscz",
    data: Uint8Array,
    fonts?: Uint8Array[],
    doLayout?: boolean,
  ) => Promise<WebMscoreScore>;
};

type WebMscoreModule = { default: WebMscoreConstructor };

export type HighFidelityMsczDependencies = {
  loadModule?: () => Promise<WebMscoreModule>;
};

let webMscoreModulePromise: Promise<WebMscoreModule> | null = null;

const loadWebMscoreModule = () => {
  if (!webMscoreModulePromise) {
    const publicBase = import.meta.env.DEV ? "/" : import.meta.env.BASE_URL;
    const scriptUrl = `${publicBase}vendor/webmscore/webmscore.js`;
    webMscoreModulePromise = new Promise<WebMscoreModule>((resolve, reject) => {
      const webMscoreWindow = window as Window & { WebMscore?: WebMscoreConstructor };
      if (webMscoreWindow.WebMscore) {
        resolve({ default: webMscoreWindow.WebMscore });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.src = scriptUrl;
      script.dataset.melodicaWebmscore = "true";
      script.addEventListener("load", () => {
        if (webMscoreWindow.WebMscore) {
          resolve({ default: webMscoreWindow.WebMscore });
        } else {
          reject(new Error("The optional MuseScore engine did not initialize."));
        }
      }, { once: true });
      script.addEventListener("error", () => {
        reject(new Error("The optional MuseScore engine could not be downloaded."));
      }, { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      webMscoreModulePromise = null;
      throw error;
    });
  }
  return webMscoreModulePromise;
};

export const convertMsczWithHighFidelity = async (
  file: File,
  dependencies: HighFidelityMsczDependencies = {},
): Promise<MsczConversionResult> => {
  await validateMsczArchiveForConversion(file);

  let score: WebMscoreScore | null = null;
  try {
    const module = await (dependencies.loadModule ?? loadWebMscoreModule)();
    const source = new Uint8Array(await file.arrayBuffer());
    score = await module.default.load("mscz", source, [], true);
    const converted = validateMsczConversionOutput(await score.saveXml(), file.name);
    return {
      ...converted,
      warnings: [HIGH_FIDELITY_MSCZ_WARNING],
    };
  } catch (error) {
    if (error instanceof MsczFileError) throw error;
    throw new MsczFileError(
      "conversion-failed",
      error instanceof Error ? error.message : undefined,
    );
  } finally {
    try {
      score?.destroy(false);
    } catch (error) {
      console.warn("Could not release the optional MSCZ conversion engine.", error);
    }
  }
};
