# 🎯 Auto-Transpose Logic in HarpTrainer

Auto-Transpose is a powerful feature in HarpTrainer that automatically finds the best transposition for a MusicXML song to make it playable on a specific harmonica key, based on the player's technical preferences.

---

## 1. The Core Objective
The goal of Auto-Transpose is to find a semitone offset (interval) that shifts all notes of a song into the playable range of the selected harmonica, while respecting constraints regarding advanced techniques like **bends** and **overblows**.

## 2. The Search Algorithm
The logic is implemented through `findBestTransposeIntervals`, `findAutoTransposeIntervals`, and `findAutoTransposeInterval` (within `src/MusicXML/musicXmlTransform.ts`). It uses a **Brute Force Search** approach:

1.  **Interval Range:** The algorithm iterates through a range of **-36 to +36 semitones** (3 octaves in both directions).
2.  **Note Analysis:** For each interval, it virtually transposes every note in the first staff of the song.
3.  **Feasibility Check:** For every transposed note, it checks if a corresponding hole/action exists on the selected harmonica key using `getHarmonicaHoleForNote`.
4.  **Scoring:** Each interval receives an invalid-note score. Missing notes are heavily penalized; filtered techniques such as bends or overblows add smaller penalties.
5.  **Best Variants:** All intervals tied for the lowest score are returned, sorted by distance from the original key. The UI can cycle through these equally optimal variants.

## 3. Playability Filters
Users can toggle specific filters to narrow down the search based on their skill level:

- **`noOverblowOrDraw` (Standard):**
    - If enabled, the algorithm penalizes intervals that result in overblow or overdraw notes (tabs ending in `o`), making easier intervals rank higher.
- **`noBend` (Beginner):**
    - If enabled, the algorithm penalizes intervals that require a bend (tabs containing `'`), making natural blow/draw intervals rank higher.

## 4. Technical Workflow

1.  **Parse XML:** The raw MusicXML is parsed into a DOM structure.
2.  **Extract Notes:** Only notes from the **first staff** are considered (matching the visual rendering policy).
3.  **Iteration Loop:**
    ```typescript
    for (let interval = -36; interval <= 36; interval++) {
      // 1. Transpose every note by 'interval'
      // 2. Check if the resulting note exists on the harmonica
      // 3. Add penalties for missing notes and filtered techniques
      // 4. Keep every interval tied for the lowest score
    }
    ```
4.  **Application:** Once one or more best intervals are found, the selected interval is saved to the application state (`transpose`). This triggers a re-render of the sheet music with updated pitches and injected harmonica tabs.

## 5. UI Integration
In the `MusicXML.tsx` route, the **"Optimize"** button triggers this logic. 
- For MusicXML, it cycles through best intervals returned by `findAutoTransposeIntervals`.
- For Guitar Pro files, it derives original MIDI notes from current playback events, finds best absolute intervals, and cycles through them.
- If no candidate interval is found, it leaves the current transposition unchanged.

---
*For source implementation, see:*
- `src/MusicXML/musicXmlTransform.ts` -> `findBestTransposeIntervals`, `findAutoTransposeIntervals`
- `src/MusicXML/MusicXML.tsx` -> `autoTransposeWithFilters`
