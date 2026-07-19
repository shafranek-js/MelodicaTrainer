# webmscore provenance

This directory contains the browser runtime from `webmscore` 1.2.1.

- Upstream: <https://github.com/LibreScore/webmscore>
- Tag: `v1.2.1`
- Commit: `78db5eb5437ccf1d17e0c4820374ee12f8862ce9`
- npm package: <https://registry.npmjs.org/webmscore/-/webmscore-1.2.1.tgz>
- License: GPL-3.0; see `LICENSE.GPL`

Only the browser JavaScript entry and the three runtime assets needed for MSCZ to
MusicXML conversion are distributed. The engine is fetched by the application
only when a user explicitly requests the optional high-fidelity conversion.

SHA-256:

```text
145877CFFCC6490D56A21DB7E080127FA748A6B67D3113703ECEF8C15EC02D1D  webmscore.js
0973455D6388C133A13106E4022C1ECC276AE9ECA7A0386ED9A22ECA04FE0750  webmscore.lib.data
5C1FCF2D898369AE2B7304E3EBEF355904999FEFE0A81BA261548D3E414D31A9  webmscore.lib.mem.wasm
512CAD6B503349ED6EC46F996256B4A7F00B6B8C8F070B2AF829C68A943CB504  webmscore.lib.wasm
```

When updating these files, update the exact upstream tag and hashes here and
rerun the MSCZ conversion tests before publishing.
