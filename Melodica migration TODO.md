# Melodica Migration TODO

## In progress

- [ ] Wire a converted melodica SoundFont once an SF2/SF3 is available.

## Pending

- [ ] Convert `public/melodica_vib/melodica vib.sfz` to SF2 or SF3.

## Done

- [x] Read migration brief.
- [x] Create migration plan.
- [x] Add a melodica domain model with keyboard ranges and note/key mapping.
- [x] Replace the Harmonica route with a Melodica keyboard visualizer.
- [x] Update app shell navigation and default route from `/harmonica` to `/melodica`.
- [x] Adapt Practice to melodica ranges, scales, and chord-tone targets.
- [x] Replace harmonica tab injection/export usage with melodica note/key labels in the active MusicXML flow.
- [x] Rework MusicXML auto-transpose around selected melodica range.
- [x] Rework Note Highway lanes from 10 holes to melodica keyboard keys.
- [x] Update Circle theory labels to remove harmonica positions.
- [x] Update README and package naming.
- [x] Run targeted tests, full tests, lint, and production build.
- [x] Redesign all melodica keyboards to look like realistic keys: long white keys with raised shorter black keys, correct piano-style overlap, and responsive sizing.
- [x] Apply realistic keyboard rendering to `src/Melodica/Melodica.tsx`.
- [x] Apply realistic keyboard rendering to `src/Practice/Practice.tsx`.
- [x] Apply realistic keyboard rendering to `src/MusicXML/NoteHighway.tsx` target line / lane header.
