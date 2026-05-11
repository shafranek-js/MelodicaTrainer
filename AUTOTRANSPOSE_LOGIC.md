# 🎯 Auto-Transpose Logic in HarpTrainer

Auto-Transpose is a powerful feature in HarpTrainer that automatically finds the best transposition for a MusicXML song to make it playable on a specific harmonica key, based on the player's technical preferences.

---

## 1. The Core Objective
The goal of Auto-Transpose is to find a semitone offset (interval) that shifts all notes of a song into the playable range of the selected harmonica, while respecting constraints regarding advanced techniques like **bends** and **overblows**.

## 2. The Search Algorithm
The logic is implemented in `findAutoTransposeInterval` (within `src/MusicXML/musicXmlTransform.ts`). It uses a **Brute Force Search** approach:

1.  **Interval Range:** The algorithm iterates through a range of **-36 to +36 semitones** (3 octaves in both directions).
2.  **Note Analysis:** For each interval, it virtually transposes every note in the first staff of the song.
3.  **Feasibility Check:** For every transposed note, it checks if a corresponding hole/action exists on the selected harmonica key using `getHarmonicaHoleForNote`.
4.  **First Match Wins:** The first interval that satisfies all conditions for *every* note in the song is returned.

## 3. Playability Filters
Users can toggle specific filters to narrow down the search based on their skill level:

- **`noOverblowOrDraw` (Standard):**
    - If enabled, the algorithm rejects any interval that results in an overblow or overdraw note (tabs ending in `o`).
- **`noBend` (Beginner):**
    - If enabled, the algorithm rejects any interval that requires a bend (tabs containing `'`). This ensures the song can be played using only natural blow and draw notes.

## 4. Technical Workflow

1.  **Parse XML:** The raw MusicXML is parsed into a DOM structure.
2.  **Extract Notes:** Only notes from the **first staff** are considered (matching the visual rendering policy).
3.  **Iteration Loop:**
    ```typescript
    for (let interval = -36; interval <= 36; interval++) {
      // 1. Transpose every note by 'interval'
      // 2. Check if the resulting note exists on the harmonica
      // 3. Apply 'noBend' and 'noOverblow' filters
      // 4. If all notes pass, return 'interval'
    }
    ```
4.  **Application:** Once an interval is found, it is saved to the application state (`transpose`). This triggers a re-render of the sheet music with updated pitches and injected harmonica tabs.

## 5. UI Integration
In the `MusicXML.tsx` route, the **"Optimize"** button triggers this logic. 
- It provides a "Success" message if a suitable key is found.
- If no interval works (common with songs spanning very large ranges), it leaves the current transposition unchanged.

---
*For source implementation, see:*
- `src/MusicXML/musicXmlTransform.ts` -> `findAutoTransposeInterval`
- `src/MusicXML/MusicXML.tsx` -> `autoTransposeWithFilters`
