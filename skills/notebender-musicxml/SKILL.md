---
name: notebender-musicxml
description: HarpTrainer MusicXML guidance for reading XML and MXL files, first-staff selection, harmonica tab injection, key transposition, HarpTabs export, OpenSheetMusicDisplay rendering, playback parsing, repeat and tie handling, Web Audio note scheduling, cursor synchronization, note-highway visuals, and scoring. Use when Codex changes anything under src/MusicXML or MusicXML-related tests.
---

# HarpTrainer MusicXML

## Start Here

Use this skill for any `src/MusicXML` work. The subsystem has pure helpers with tests plus a React route that coordinates OSMD, playback, microphone scoring, and downloads.

Key files:

- `src/MusicXML/MusicXML.tsx`: route container, file state, transform pipeline, OSMD lifecycle, playback scheduling, cursor sync, scoring, downloads.
- `src/MusicXML/musicXmlTransform.ts`: transposition, first-staff display XML, harmonica fingering injection, HarpTabs export, auto-transpose search.
- `src/MusicXML/musicXmlSelection.ts`: first part and first staff selection helpers.
- `src/MusicXML/musicXmlFile.ts`: raw MusicXML and compressed MXL loading with JSZip.
- `src/MusicXML/playbackParser.ts`: MusicXML events, tempo, dynamics, articulations, chords, rests, repeats, ties, and cursor source indexes.
- `src/MusicXML/playbackTimeline.ts`: timeline timings, lane keys, visible events, target hit selection.
- `src/MusicXML/audioPlayback.ts`: Web Audio synthesis and scheduled-node cleanup.
- `src/MusicXML/NoteHighway.tsx`: playback controls, stats, lanes, tiles, detected pitch status.
- `src/MusicXML/*.test.ts`: Vitest coverage for transforms, parsing, and timeline helpers.

## XML Rules

Use DOMParser and XMLSerializer. Do not use regex or raw string slicing to inspect or rewrite MusicXML.

Preserve the first-part and first-staff model unless the task explicitly changes it. `createFirstStaffDisplayXml` removes extra parts and lower staves for OSMD display, while transform and parse helpers use `musicXmlSelection.ts` to target the same first-staff behavior.

When injecting tabs:

- Transpose only targeted first-staff notes.
- Update key signatures through `transposeKeySignatures`.
- Rewrite pitch with `writePitch`.
- Remove `default-y` and `relative-y` from changed notes.
- Replace old fingering entries, then write the harmonica tab into `notations/technical/fingering` with `placement="below"`.
- Insert notations before lyrics, play, or listen elements when creating a notation block.

When exporting HarpTabs text, group chord fingerings with `/` and emit one non-empty line per measure.

## Playback And Timing

Keep parser behavior aligned with OSMD cursor movement. `sourceEventIndex` maps playback events back to score-wide cursor positions, including skipped lower-staff material.

Preserve repeat expansion and tie resolution. Tie stops should not replay, while tie starts accumulate duration across following tied notes.

Use `createPlaybackTimeline(events, tempoScale)` as the source for note-highway timing. The route schedules note playback with the event's effective tempo and adjusts game clock offset by measured audio output latency.

When changing note-highway scoring, check the related constants in `src/MusicXML/constants.ts`. Current hit detection uses target MIDI membership plus a cents threshold in `MusicXML.tsx`.

## React And Resource Lifecycle

Guard asynchronous OSMD render work with the existing render-run ref pattern. Keep cursor reset, hide, and scroll behavior in sync with playback state.

On playback stop or route unmount, clear timers, cancel animation frames, stop active audio nodes, and reset game state only when the caller asks for a reset.

Keep microphone detection enabled only while playback is active and events exist.

## Validation

Run targeted tests while iterating:

- `npm test -- src/MusicXML/musicXmlTransform.test.ts`
- `npm test -- src/MusicXML/playbackParser.test.ts`
- `npm test -- src/MusicXML/playbackTimeline.test.ts`

Run `npm test` before finishing meaningful MusicXML helper changes. Run `npm run build` after React, OSMD, audio, or note-highway changes.
