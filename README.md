# MelodicaTrainer

MelodicaTrainer is an interactive React application for melodica practice. It combines real-time microphone pitch detection, a selectable melodica keyboard range, MusicXML/Guitar Pro playback, a note-highway practice view, and a circle-of-fifths theory explorer.

## Key Features

### Real-Time Pitch Detection

- Select common melodica ranges: 25, 27, 32, 37, or 44 keys, including the Hammond 44 range (C3-G6).
- See the detected note on a virtual keyboard.
- Check pitch accuracy in cents.

### Note Highway

- Load MusicXML, MXL, and Guitar Pro files.
- Browse a local, searchable library of 100 MusicXML scores and 12 Guitar Pro files, with difficulty, format, tag, source, and license filters.
- Practice against synced playback and target lanes.
- Auto-transpose material into the selected melodica range.
- Track hits, misses, streak, and accuracy.

### Practice

- Practice notes from selected scales.
- Use scale, chord-tone, and 12-bar blues modes.
- Filter pitch detection to the selected melodica range.

### Circle of Fifths

- Explore roots, modes, scales, triads, and scale degrees.
- Use the theory view independently from a fixed instrument tuning.

## SoundFont Note

The repository includes `public/melodica_vib`, which contains an SFZ file and WAV samples. The current playback engine uses SpessaSynth and expects SF2/SF3/DLS-style sound banks, so the SFZ set should be converted to SF2 or SF3 before it can be used as the default melodica sound.

## Technical Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- Web Audio API + SpessaSynth
- Pitchy
- OpenSheetMusicDisplay
- alphaTab
- Tonal

## Getting Started

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm test
npm run lint
npm run build
```

The production build starts with `npm run library:check`. It verifies the score catalog, local paths, sizes, SHA-256 hashes, MusicXML playback content, and Guitar Pro round trips before Vite builds the application. See [`public/score-library/README.md`](public/score-library/README.md) for the content breakdown and reproducible import commands.

## License

See [LICENSE](LICENSE).
