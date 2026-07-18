# webmscore provenance

This directory contains the browser runtime from `webmscore` 1.0.0.

- Upstream: <https://github.com/LibreScore/webmscore>
- Tag: `v1.0.0`
- Commit: `27fae042078cbaed396920ff70662cca0417431c`
- npm package: <https://registry.npmjs.org/webmscore/-/webmscore-1.0.0.tgz>
- License: GPL-3.0; see `LICENSE.GPL`

Only the browser JavaScript entry and the three runtime assets needed for MSCZ to
MusicXML conversion are distributed. The engine is fetched by the application
only when a user explicitly requests the optional high-fidelity conversion.

SHA-256:

```text
609B7392D70F6170096E54558664D4DC27A4E11CA5EB06481C0113BDCAEE1BB1  webmscore.js
92E09D8C4B1291615EA037717EDEDA2F1150802D64A5E7CB614FCE0339525CF4  webmscore.lib.data
D63CF90470CDCE64A4FA2400262D9DC394C38A5CD21D8D53871A235CF9A1802E  webmscore.lib.mem.wasm
08B3AFC6A0B19851A676411ED370A185A3568F91560F4B6A124F2D37D5ED88FB  webmscore.lib.wasm
```

When updating these files, update the exact upstream tag and hashes here and
rerun the MSCZ conversion tests before publishing.
