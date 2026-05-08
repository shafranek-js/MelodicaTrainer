---
name: notebender-harmonica-core
description: NoteBender harmonica domain guidance for diatonic harmonica layouts, hole mapping, blow and draw notation, bends, overblows, overdraws, frequency-to-note conversion, microphone pitch detection, tuning cents feedback, and shared harmonica utilities. Use when Codex changes src/utils/utils.ts, src/hooks/usePitchDetector.tsx, the Harmonica route, or shared pitch and layout behavior used by Practice or MusicXML.
---

# NoteBender Harmonica Core

## Start Here

Use this skill before changing harmonica math or pitch detection. These helpers are shared by the Harmonica visualizer, Practice trainer, and MusicXML tab injection, so small changes can move several features at once.

Key files:

- `src/utils/utils.ts`: harmonica keys, layout generation, frequency conversion, and note-to-hole mapping.
- `src/hooks/usePitchDetector.tsx`: microphone permission, Pitchy integration, RMS and clarity gating, stable-frame filtering, and cleanup.
- `src/Harmonica/Harmonica.tsx`: real-time layout visualization and tuning line.
- `src/Practice/Practice.tsx`: consumes layout and pitch detection for training targets.
- `src/MusicXML/musicXmlTransform.ts`: uses `getHarmonicaHoleForNote` for MusicXML fingering injection.

## Domain Conventions

Represent holes as arrays of length 10, where array index `0` is hole 1. Use `null` for impossible notes in a row so the grid alignment stays stable.

Use tab text consistently:

- Positive hole numbers mean blow notes.
- Negative hole numbers mean draw notes.
- Apostrophes represent bends.
- `o` represents overblow or overdraw.

Keep the existing public layout keys stable unless all consumers are updated. Note that `HalfStepBlowBend` is capitalized differently from the other row keys and is currently consumed as-is.

Use Tonal `Note` and `Interval` APIs for transposition, MIDI, chroma, frequency, and pitch-class work. Prefer MIDI comparisons for equality across enharmonic spellings.

## Pitch Detection

Use `usePitchDetector(minClarity, enabled, options)` rather than duplicating microphone logic. The hook supports:

- `allowedMidiNumbers` to reject unrelated pitches.
- `minRms` to reject quiet input.
- `stableFrames` to reduce flicker.

When changing the hook, preserve cleanup of requestAnimationFrame, audio contexts, media tracks, candidate MIDI state, and stable-frame counters. Keep errors user-visible through the returned `error` value.

Use `freqToNoteAndCents` for tuning displays. Convert the detected string pitch back to a number before passing it in.

## Visual Feedback

Map cents to a small clamped vertical tuning offset. The Harmonica and Practice routes both use this pattern, so keep the sign convention consistent: sharp notes move the line upward through the current negative offset calculation.

Translate displayed pitch classes with `t(Note.pitchClass(...))` or `t(Note.simplify(Note.pitchClass(...)))`.

## Validation

Run `npm run build` after any harmonica core or pitch hook change. Add focused tests around pure helpers in `src/utils/utils.ts` when changing layout or hole mapping behavior; the existing MusicXML transform tests also exercise `getHarmonicaHoleForNote` indirectly.
