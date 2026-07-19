export type WebMscoreScore = {
  destroy: (soft?: boolean) => void;
  rpc: (
    method: "load",
    params: ["midi", Uint8Array, Uint8Array[], boolean],
    transfer?: Transferable[],
  ) => Promise<unknown>;
  saveAudio: (format: "mp3") => Promise<Uint8Array>;
  saveXml: () => Promise<string>;
  setSoundFont: (data: Uint8Array) => Promise<void>;
};

export type WebMscoreConstructor = {
  load: (
    format: "midi" | "mscz",
    data: Uint8Array,
    fonts?: Uint8Array[],
    doLayout?: boolean,
  ) => Promise<WebMscoreScore>;
};

export type WebMscoreModule = { default: WebMscoreConstructor };

let webMscoreModulePromise: Promise<WebMscoreModule> | null = null;

export const loadWebMscoreModule = () => {
  if (!webMscoreModulePromise) {
    const publicBase = import.meta.env.DEV ? "/" : import.meta.env.BASE_URL;
    const scriptUrl = `${publicBase}vendor/webmscore/webmscore.js`;
    webMscoreModulePromise = new Promise<WebMscoreModule>((resolve, reject) => {
      const webMscoreWindow = window as Window & { WebMscore?: WebMscoreConstructor };
      if (webMscoreWindow.WebMscore) {
        resolve({ default: webMscoreWindow.WebMscore });
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-melodica-webmscore="true"]',
      );
      const script = existingScript ?? document.createElement("script");
      const handleLoad = () => {
        if (webMscoreWindow.WebMscore) {
          resolve({ default: webMscoreWindow.WebMscore });
        } else {
          reject(new Error("The optional MuseScore engine did not initialize."));
        }
      };
      const handleError = () => {
        script.remove();
        reject(new Error("The optional MuseScore engine could not be downloaded."));
      };
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      if (!existingScript) {
        script.async = true;
        script.src = scriptUrl;
        script.dataset.melodicaWebmscore = "true";
        document.head.appendChild(script);
      }
    }).catch((error) => {
      webMscoreModulePromise = null;
      throw error;
    });
  }
  return webMscoreModulePromise;
};
