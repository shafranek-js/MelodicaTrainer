import * as alphaTab from "@coderline/alphatab";

const hiddenScoreInfoElements = new Map<alphaTab.NotationElement, boolean>([
    [alphaTab.NotationElement.ScoreTitle, false],
    [alphaTab.NotationElement.ScoreSubTitle, false],
    [alphaTab.NotationElement.ScoreArtist, false],
    [alphaTab.NotationElement.ScoreAlbum, false],
    [alphaTab.NotationElement.ScoreWords, false],
    [alphaTab.NotationElement.ScoreMusic, false],
    [alphaTab.NotationElement.ScoreWordsAndMusic, false],
    [alphaTab.NotationElement.ScoreCopyright, false],
    [alphaTab.NotationElement.GuitarTuning, false],
    [alphaTab.NotationElement.TrackNames, false],
    [alphaTab.NotationElement.ChordDiagrams, false],
    [alphaTab.NotationElement.EffectLyrics, false],
    [alphaTab.NotationElement.EffectText, false],
    [alphaTab.NotationElement.EffectDynamics, false],
]);

type AlphaTabSettingsOptions = {
    baseUrl: string;
    scrollElement: HTMLElement;
    soundFontPath: string;
};

export const createAlphaTabSettings = ({
    baseUrl,
    scrollElement,
    soundFontPath,
}: AlphaTabSettingsOptions) => ({
    core: {
        logLevel: alphaTab.LogLevel.Info,
        fontDirectory: `${baseUrl}font/`,
        engine: "svg",
    },
    player: {
        playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableElementHighlighting: true,
        soundFont: soundFontPath,
        scrollElement,
    },
    display: {
        layoutMode: alphaTab.LayoutMode.Horizontal,
        padding: [8, 0, 8, 0],
        firstSystemPaddingTop: 0,
        systemPaddingTop: 0,
        systemPaddingBottom: 0,
        lastSystemPaddingBottom: 0,
        firstNotationStaffPaddingTop: 0,
        lastNotationStaffPaddingBottom: 0,
        notationStaffPaddingTop: 0,
        notationStaffPaddingBottom: 0,
    },
    notation: {
        elements: hiddenScoreInfoElements,
    },
});

export const applyHarmonicaNotationView = (track: alphaTab.model.Track) => {
    track.staves.forEach((staff) => {
        staff.showStandardNotation = true;
        staff.showTablature = false;
        if (!staff.standardNotationLineCount) {
            staff.standardNotationLineCount = 5;
        }
    });
};
