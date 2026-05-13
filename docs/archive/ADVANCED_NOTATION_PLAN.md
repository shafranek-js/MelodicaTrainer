# 🚀 Implementation Plan: Advanced Notation (Visualizing Techniques)

This document outlines the strategy for adding visual representations of advanced harmonica techniques (bends, overblows, articulation, etc.) to the `NoteHighway` component, inspired by intuitive shape-based notation systems (like TurboTab).

## 1. Goal
Move beyond simple rectangular blocks to convey *how* a note should be played without relying solely on text or numbers. We will use block **width**, **shape**, and **gradients** to indicate bends, overblows, and phrasing.

## 2. Visual Dictionary (Mapping Technique to Shape)

Based on the reference material, here is how we will translate techniques into CSS/SVG representations within a single lane (column):

### A. Core Techniques (Width & Direction)
*   **Natural Notes (Blow/Draw):** Standard width (e.g., 80% of the lane width).
    *   *Implementation:* Current `w-10%` with standard borders.
*   **Bends (Draw Bends & Blow Bends):** The block becomes **narrower** (squeezed). The deeper the bend, the narrower the block.
    *   *1 Semitone Bend (`'`):* Medium narrow.
    *   *2 Semitone Bend (`"`):* Very narrow.
    *   *3 Semitone Bend (`'''`):* Extremely narrow.
    *   *Implementation:* Dynamic `width` inline style based on the number of `'` or `"` characters in the tab string.
*   **Overblows / Overdraws:** The block becomes **wider** (bulging outward, potentially overlapping slightly into adjacent lanes).
    *   *Implementation:* Width > 100% of the lane, possibly using a distinct border style (e.g., dotted or double).

### B. Transitions (Shape Morphing)
Currently, notes are separate rectangles. We need to visualize smooth transitions (glissandos/scoops).
*   **Natural $\to$ Bend (Scoop):** The block starts wide at the bottom and tapers to narrow at the top (like a trapezoid or cone).
*   **Bend $\to$ Natural (Release):** The block starts narrow at the bottom and widens at the top.
*   **Bend $\to$ Bend (e.g., -3" to -3'):** A shape that changes width mid-block.
*   *Implementation Strategy:* Standard CSS rectangles cannot easily form trapezoids while maintaining our continuous background color logic. We will need to transition from `div` blocks to **SVG `<polygon>` or `<path>` elements** inside the `NoteHighway` container.

### C. Articulation & Effects (Textures)
*   **Vibrato:** A horizontal gradient or a wavy texture overlay.
    *   *Implementation:* CSS `background-image: repeating-linear-gradient(...)` or an SVG pattern.
*   **Tremolo / Trill:** Scalloped or jagged edges on the sides of the block.
    *   *Implementation:* SVG `<path>` with bezier curves along the vertical edges.
*   **Staccato / Triplets:** Breaking a long block into visually distinct segments with tight grouping.

## 3. Phased Implementation Strategy

### Phase 1: Dynamic Widths (CSS-only)
The easiest first step. We keep `div` blocks but change their width based on the tab string.
1.  **Parse Bend Depth:** Update `playbackParser.ts` or add a utility to extract bend depth from the tab (e.g., `-3''` -> depth 2).
2.  **Apply CSS Width:** In `NoteHighway.tsx`, calculate a dynamic `width` and `marginLeft`/`marginRight` (to keep it centered) based on bend depth.
    *   *Example:* Natural = `width: 80%`, Bend 1 = `width: 60%`, Bend 2 = `width: 40%`.

### Phase 2: The SVG Migration (Complex Shapes)
To support trapezoids (smooth transitions between bends and natural notes on the same hole), we must abandon CSS `div`s for the notes.
1.  **Overlay an SVG Canvas:** Add an `<svg>` element covering the entire highway track.
2.  **Generate Paths:** Write a function that takes a continuous sequence of notes on the *same hole* and generates a single SVG `<polygon>`.
    *   If note 1 is Natural and note 2 is a Bend, the polygon points will connect the wide base of note 1 to the narrow top of note 2.
3.  **Color & Glow:** Re-implement the red/blue coloring and the "wasHit" white glow using SVG `fill`, `stroke`, and `<filter>` (for drop shadows).

### Phase 3: Textures and Ornaments
1.  **Parse MusicXML Ornaments:** Update `playbackParser.ts` to detect `<vibrato>`, `<tremolo>`, or `<glissando>` tags.
2.  **Apply SVG Patterns:** Map these flags to SVG `<pattern>` definitions (e.g., wavy lines for vibrato) and apply them to the `fill` of the corresponding note paths.

## 4. Required Core Changes

1.  **`types.ts`:** `PlaybackNote` needs new properties: `bendDepth` (number), `isOverblow` (boolean), `ornament` (enum: vibrato, tremolo, none).
2.  **`playbackParser.ts`:** Needs to extract the above data from the raw MusicXML DOM.
3.  **`NoteHighway.tsx`:** Complete rewrite of the note rendering loop, transitioning from mapping `<div>`s to mapping SVG paths within a master `<svg>` container.