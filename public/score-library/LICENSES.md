# Score Library Rights Notes

The license fields in `catalog.json` are authoritative per asset. `rightsReviewedAt` records the last review date.

## MuseTrainer — 12 MusicXML files

MuseTrainer describes its repository as a public-domain MusicXML library, but the repository does not contain a machine-readable license for each score. These 12 pre-existing entries are therefore marked `PUBLIC_DOMAIN` with `basis: source-declared`. This is the library's only source-declared exception.

- Source: https://github.com/musetrainer/library
- Public library: https://musetrainer.github.io/library/
- Rights marker used in the catalog: https://creativecommons.org/publicdomain/mark/1.0/

## OpenScore Lieder — 18 MusicXML files

OpenScore Lieder is released under CC0. Selected `.mscx` sources were converted offline with MuseScore 3.6.2; the committed `.mxl` files are the runtime assets.

- Source: https://github.com/OpenScore/Lieder
- License: https://creativecommons.org/publicdomain/zero/1.0/

## PDMX — 58 MusicXML files

The approved records come from the PDMX no-license-conflict, all-valid, deduplicated subsets. Paywalled and official-score records are excluded. Each selected record was also reviewed for a public-domain underlying composition and a non-conflicting arrangement. The entry preserves the upstream CC0 or Public Domain Mark status.

- Dataset record: https://zenodo.org/records/15571083
- Project: https://github.com/pnlong/PDMX
- CC0: https://creativecommons.org/publicdomain/zero/1.0/
- Public Domain Mark: https://creativecommons.org/publicdomain/mark/1.0/

## Melodica Trainer CC0 transcriptions — 31 MusicXML files

These are independent, one-part/one-staff transcriptions of traditional public-domain children's and folk melodies. The reviewed notation reference for each melody is preserved in its catalog entry, and the generated MusicXML transcription is dedicated to CC0 1.0. The deterministic source data lives in `scripts/library-selections/cc0-melodies.json` and `scripts/library-selections/zpevnik-czech.json`.

The 19 additional Czech melodies use public song cards and downloadable custom song XML from `zpevnik.beil.cz` as notation references. The upstream archives are not standard MusicXML, are not shipped in this repository, and are not assigned an upstream open-content license here. Only independently generated MusicXML transcriptions of traditional public-domain melodies are distributed under this project's CC0 dedication.

- CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/

## Guitar Pro files — 12 files

Six melody files are alphaTab GP7 conversions of reviewed PDMX MusicXML and retain the corresponding CC0 or Public Domain status. Six exercises (scale, arpeggio, intervals, rhythm, chords, and key changes) are original Melodica Trainer materials dedicated to CC0 1.0.

- CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/
