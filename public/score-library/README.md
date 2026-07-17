# Melodica Trainer Score Library

This directory is the application's self-contained score library. The browser loads only `catalog.json` and the committed assets below it; it never fetches a score from an upstream catalog at runtime.

## Contents

- 75 MusicXML files: 12 MuseTrainer, 18 OpenScore Lieder, and 45 PDMX.
- 12 Guitar Pro 7 files: six melodies converted from reviewed PDMX MusicXML and six original CC0 exercises.
- 64 of the 75 MusicXML entries are tagged `beginner` or `familiar`.

The authoritative metadata is `catalog.json`. Every entry records its source, rights basis, review date, byte size, and SHA-256 checksum. See `LICENSES.md` for the source-level rights notes.

## Validation

From the repository root:

```bash
npm run library:check
npm run library:generate-gp
npm run library:catalog
```

`npm run build` runs `library:check` first. Validation expands every MXL, parses MusicXML, checks first-part/first-staff playable notes, imports every GP file with alphaTab, and enforces the exact source counts.

## Reproducible imports

OpenScore Lieder conversion is an offline maintainer task. It requires a checkout of the CC0 repository and MuseScore 3.6.2; MuseScore is not installed by the web build or GitHub Actions.

```bash
node scripts/import-score-library.mjs --source openscore-lieder --input <lieder-checkout> --selection scripts/library-selections/openscore-lieder.json --musescore <MuseScore3-executable>
```

PDMX import uses a locally downloaded `mxl.tar.gz` and the approved 45-record selection. The separate metadata check proves that each selected row is deduplicated, valid, in the no-license-conflict subset, not paywalled, not official, and marked CC0 or Public Domain.

```bash
npm run library:verify-pdmx -- --csv <PDMX.csv> --selection scripts/library-selections/pdmx.json
node scripts/import-score-library.mjs --source pdmx --input <mxl.tar.gz> --selection scripts/library-selections/pdmx.json
```

After changing an approved selection, regenerate GP files when needed, regenerate `catalog.json`, and run the full checks before committing.
