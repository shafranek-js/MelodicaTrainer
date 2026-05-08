---
name: notebender-practice-trainer
description: NoteBender Practice trainer guidance for the Practice route, harmonica key and position controls, scale selection, explore mode, note practice targets, bend trainer targets, 12-bar blues chord highlighting, microphone hit detection, and trainer UI behavior. Use when Codex changes src/Practice/Practice.tsx or shared helpers specifically for practice workflows.
---

# NoteBender Practice Trainer

## Start Here

Use this skill for `src/Practice/Practice.tsx`. The route is a dense practice workspace built from shared harmonica layout helpers, Tonal theory helpers, and the pitch detector hook.

Related files:

- `src/Practice/Practice.tsx`: trainer modes, controls, target generation, layout highlighting, pitch feedback.
- `src/utils/utils.ts`: harmonica layout and note conversion.
- `src/hooks/usePitchDetector.tsx`: microphone detection and filtering.
- `src/i18n.js`: pitch-class display translation.

## Trainer Model

Keep `positionOptions`, `scaleOptions`, `trainerModes`, and `layoutRows` close to the top of the file unless they become shared data. These arrays define most of the route behavior.

Derived state should stay memoized:

- `layout` from `generateLayout(key)`.
- major key scale from the selected harmonica key.
- selected position tonic and mode scale.
- chosen scale from either position mode or Tonal `Scale.get`.
- active pitch classes and chord pitch classes.
- practice and bend target lists.
- allowed MIDI numbers for the pitch detector.

Reset `targetIndex` when key, position, scale, or trainer mode changes so the target stays valid for the new selection.

## Modes

Explore mode should show scale membership without forcing a target.

Practice mode should use all playable targets in the selected scale.

Bends mode should filter targets to layout rows whose labels include `bend`.

12-bar blues mode should use `bluesBars` and highlight chord tones for the current bar. Keep I, IV, and V roots derived from the selected position tonic.

## Pitch And Hit Logic

Use the shared pitch detector with the selected harmonica's allowed MIDI set. Convert detected pitch through `freqToNoteAndCents`.

Practice hit detection currently requires exact MIDI match and `abs(cents) <= 25`. Keep this tighter threshold intentional if adjusting note-highway behavior separately.

Use translated pitch classes for user-facing note labels, but keep full note names where octave matters for debugging or target identity.

## UI Patterns

Keep the layout scrollable horizontally on small screens. The harmonica grid depends on fixed 10-column rows.

Use compact controls and route-local panels. Do not add explanatory onboarding copy unless the user explicitly asks for teaching content.

## Validation

Run `npm run build` after Practice changes. If changing shared harmonica utilities, also use the `notebender-harmonica-core` skill and add focused pure-helper tests where practical.
