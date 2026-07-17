export const MUSETRAINER_LIBRARY_PAGE_URL =
  "https://musetrainer.github.io/library/";

export const MUSETRAINER_SCORE_BASE_URL =
  "https://musetrainer.github.io/library/scores/";

export type ScoreLibraryEntry = {
  composer: string;
  fileName: string;
  id: string;
  tags: readonly string[];
  title: string;
};

export const getScoreLibraryDownloadUrl = (entry: ScoreLibraryEntry) =>
  new URL(entry.fileName, MUSETRAINER_SCORE_BASE_URL).toString();

export const SCORE_LIBRARY = [
  {
    id: "twinkle-variations",
    title: "Twinkle Twinkle Little Star",
    composer: "Traditional / W. A. Mozart",
    fileName: "12_Variations_of_Twinkle_Twinkle_Little_Star.mxl",
    tags: ["classical", "familiar"],
  },
  {
    id: "ode-to-joy-easy",
    title: "Ode to Joy — Easy Variation",
    composer: "Ludwig van Beethoven",
    fileName: "Ode_to_Joy_Easy_variation.mxl",
    tags: ["beginner", "classical"],
  },
  {
    id: "happy-birthday",
    title: "Happy Birthday to You",
    composer: "Traditional",
    fileName: "Happy_Birthday_To_You_Piano.mxl",
    tags: ["beginner", "familiar"],
  },
  {
    id: "bella-ciao",
    title: "Bella Ciao",
    composer: "Traditional",
    fileName: "Bella_Ciao_-_La_Casa_de_Papel.mxl",
    tags: ["folk", "familiar"],
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    composer: "Traditional",
    fileName: "Greensleeves_for_Piano_easy_and_beautiful.mxl",
    tags: ["folk", "beginner"],
  },
  {
    id: "minuet-in-g-bwv-anh-114",
    title: "Minuet in G Major, BWV Anh. 114",
    composer: "Christian Petzold",
    fileName: "Bach_Minuet_in_G_Major_BWV_Anh._114.mxl",
    tags: ["classical", "beginner"],
  },
  {
    id: "fur-elise-beginner",
    title: "Für Elise — Beginner Arrangement",
    composer: "Ludwig van Beethoven",
    fileName: "Fur_Elise_-_Beethoven_-_for_beginner_piano.mxl",
    tags: ["classical", "beginner"],
  },
  {
    id: "gymnopedie-1",
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    fileName: "Erik_Satie_-_Gymnopedie_No.1.mxl",
    tags: ["classical", "slow"],
  },
  {
    id: "canon-in-d",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    fileName: "Canon_in_D.mxl",
    tags: ["classical"],
  },
  {
    id: "sugar-plum-fairy",
    title: "Dance of the Sugar Plum Fairy",
    composer: "Pyotr Ilyich Tchaikovsky",
    fileName: "Dance_of_the_sugar_plum_fairy.mxl",
    tags: ["classical"],
  },
  {
    id: "swan-lake",
    title: "Swan Lake",
    composer: "Pyotr Ilyich Tchaikovsky",
    fileName: "Swan_Lake.mxl",
    tags: ["classical"],
  },
  {
    id: "the-entertainer",
    title: "The Entertainer",
    composer: "Scott Joplin",
    fileName: "The_Entertainer_-_Scott_Joplin.mxl",
    tags: ["ragtime"],
  },
] as const satisfies readonly ScoreLibraryEntry[];
