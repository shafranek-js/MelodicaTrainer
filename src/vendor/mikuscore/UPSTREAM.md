# mikuscore conversion core

This directory contains the minimal MuseScore-to-MusicXML import graph vendored
from [igapyon/mikuscore](https://github.com/igapyon/mikuscore).

- Upstream commit: `4e42005c8a48293269e96a0e3513f9af2e344dc2`
- Upstream version: `0.5.0`
- License: Apache License 2.0 (see `LICENSE`)
- Imported: 2026-07-18

Only `musescore-io.ts` and its browser-safe conversion dependencies are
included. The mikuscore UI, CLI runtime, Verovio renderer, sample scores, and
unrelated format converters are intentionally excluded. Source copyright and
SPDX headers are preserved. Three unused export-path-only helpers/parameters in
`musescore-io.ts` were removed or renamed so the selected import graph satisfies
MelodicaTrainer's `noUnusedLocals` and `noUnusedParameters` checks.

Updates are manual: replace the selected source graph, update the pinned commit,
and rerun the MSCZ conversion and application test suites before shipping.
