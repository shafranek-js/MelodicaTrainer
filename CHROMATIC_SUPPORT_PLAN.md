# Implementation Plan: Chromatic Harmonica Support

This document outlines the plan for adding chromatic harmonica support to NoteBender, with a focus on 10-hole chromatic models like the **Cascha HH 2272**.

## 1. Goal
Enable users to switch between Diatonic and Chromatic harmonicas, providing accurate pitch visualization and tablature generation for both.

## 2. Research Findings
The **Cascha HH 2272** is a 10-hole chromatic harmonica using **Solo Tuning**.
- **Range:** C4 to F#6 (2.5 octaves).
- **Layout:**
    - Each hole has 4 notes: Blow/Draw (Slide Out) and Blow/Draw (Slide In).
    - Uses the "Double C" pattern (Holes 4 & 5 Blow are both C5).
    - Slide In raises notes by a half-step.

## 3. Proposed Changes

### 3.1 Data Model & Utilities (`src/utils/utils.ts`)
- **Introduce `HarmonicaType` enum/type:** `DIATONIC | CHROMATIC`.
- **Refactor `generateLayout`:**
    - Accepts `harmonicaType`.
    - Implements Solo Tuning logic for Chromatic.
    - Handles the 10-hole specific layout (C4 start).
- **Update `getHarmonicaHoleForNote`:**
    - Implement Chromatic tab notation.
    - Standard notation: `4` (Blow), `-4` (Draw), `4<` (Blow + Slide), `-4<` (Draw + Slide).

### 3.2 State Management
- Add `harmonicaType` to the application state (e.g., in `Harmonica.tsx` and `MusicXML.tsx`).
- Persist user preference in `localStorage`.

### 3.3 UI Components
- **Settings/Configuration:**
    - Add a toggle/select for "Harmonica Type" (Diatonic vs. Chromatic).
- **Harmonica Layout (`Harmonica.tsx`):**
    - Dynamic row labels based on type.
    - For Chromatic: "Blow (Slide In)", "Draw (Slide In)", "Blow", "Draw".
    - Hide/Disable Bend rows when in Chromatic mode.
- **Pitch Visualizer:**
    - Ensure real-time highlighting works across the expanded 4-note-per-hole layout.

### 3.4 MusicXML & Tablature (`src/MusicXML/musicXmlTransform.ts`)
- Update the injection logic to use the chromatic mapping when selected.
- Adjust the auto-transpose logic to account for the chromatic range (avoiding the need for bends/overblows).

## 4. Implementation Steps

1.  **Phase 1: Core Logic Update**
    - Modify `utils.ts` to support `generateLayout` for chromatic.
    - Add unit tests for the new chromatic layout.

2.  **Phase 2: UI Integration**
    - Add the "Harmonica Type" selector to the main interface.
    - Update `Harmonica.tsx` to render the correct rows based on selection.

3.  **Phase 3: Tab Generation**
    - Update `getHarmonicaHoleForNote` to return chromatic-style tabs.
    - Verify with `MusicXML` viewer.

4.  **Phase 4: Validation**
    - Test with the user's specific model (Cascha HH 2272) using real-time pitch input.
    - Ensure backward compatibility for diatonic users.

## 5. Potential Challenges
- **Enharmonic Notes:** Chromatic harmonicas have multiple ways to play the same note (e.g., Draw 3 Slide In is C5, same as Blow 4 Slide Out). Logic must prefer the most common/easiest mapping.
- **Visual Space:** 4 rows for chromatic + labels might require adjusting the layout height in the UI.
