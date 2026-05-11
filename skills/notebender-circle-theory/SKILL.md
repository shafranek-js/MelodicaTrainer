---
name: notebender-circle-theory
description: HarpTrainer Circle route guidance for circle of fifths rendering, harmonica positions, modal degree mapping, scale selection, Tonal scale and chord calculations, triad quality display, responsive circle sizing, color semantics, and translated note labels. Use when Codex changes src/Circle/Circle.tsx or shared theory data for the circle-of-fifths experience.
---

# HarpTrainer Circle Theory

## Start Here

Use this skill for `src/Circle/Circle.tsx`. This route is a theory explorer that maps the circle of fifths to harmonica positions, scale degrees, and diatonic triads.

Related files:

- `src/Circle/Circle.tsx`: circle geometry, mode and scale controls, triad display, legend.
- `src/i18n.js`: translated pitch-class labels.
- `src/Menu.tsx` and `src/App.tsx`: route access if navigation changes.

## Theory Model

Preserve the `modes` data shape unless all dependent code is updated. It contains:

- mode name.
- major-scale degree used to find the mode tonic.
- harmonica position label.
- harmonica order used for display sorting.

Generate the circle by transposing C by perfect fifths and simplifying the note. Use Tonal chroma comparisons for membership so enharmonic spellings do not break highlighting.

When selected scale is `mode`, rotate the selected major scale from the mode degree. Otherwise, ask Tonal for `${modeTonic} ${selectedScale}`.

Only build triads when the active scale has 7 notes. Detect chord quality through Tonal `Chord.detect`.

## Visual Semantics

Keep tonic highlighting independent from scale and triad coloring. The cyan border marks the tonic of the selected mode.

Use `chordQualityColors` as the single source for color semantics. If adding a quality, update both the circle cells and legend.

Keep scale degree markers positioned inside the outer note ring. Use the same angle step so inner degree dots stay aligned with their outer notes.

Use `t(note)` for displayed note labels and leave underlying Tonal calculations in pitch-class strings.

## Responsive Behavior

Keep `getResponsiveSize` window-based and update dimensions on resize. Avoid layout shifts that move the circle outside the viewport on narrow screens.

The controls are horizontal scroll rows. Preserve that behavior for small screens rather than wrapping into a tall control block.

## Validation

Run `npm run build` after Circle changes. Manually check `/circle` in the dev server for at least a narrow and desktop viewport when changing geometry or label sizing.
