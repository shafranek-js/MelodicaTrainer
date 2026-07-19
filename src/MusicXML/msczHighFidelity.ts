import type { MsczConversionResult } from "./msczFile";
import {
  MsczFileError,
  validateMsczArchiveForConversion,
  validateMsczConversionOutput,
} from "./msczFile";
import { loadWebMscoreModule } from "./webMscore";
import type { WebMscoreScore } from "./webMscore";

export const HIGH_FIDELITY_MSCZ_WARNING =
  "Converted with the optional MuseScore 4.0 compatibility engine. Review the score before practice because this engine cannot report partial notation loss.";

export type HighFidelityMsczDependencies = {
  loadModule?: () => Promise<{
    default: {
      load: (
        format: "mscz",
        data: Uint8Array,
        fonts?: Uint8Array[],
        doLayout?: boolean,
      ) => Promise<Pick<WebMscoreScore, "destroy" | "saveXml">>;
    };
  }>;
};

export const convertMsczWithHighFidelity = async (
  file: File,
  dependencies: HighFidelityMsczDependencies = {},
): Promise<MsczConversionResult> => {
  await validateMsczArchiveForConversion(file);

  let score: Pick<WebMscoreScore, "destroy" | "saveXml"> | null = null;
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
