# 🎼 How Musical Notation is Loaded in HarpTrainer

This document provides a technical overview of the pipeline used to load, transform, and render musical notation (sheet music) within the HarpTrainer application.

---

## 1. File Loading (MusicXML & MXL)
The process starts in the `MusicXML.tsx` component. The application supports two primary ways to ingest music data:

- **Default Content:** Upon first load, the app fetches `IntroSong.musicxml` from the `public/` directory using the standard Web Fetch API.
- **User Uploads:** Users can upload `.xml`, `.musicxml`, or compressed `.mxl` files. 
    - The `readMusicXmlFile` utility (in `src/MusicXML/musicXmlFile.ts`) handles the reading.
    - For `.mxl` files, **JSZip** is used to decompress the archive and locate the primary score XML file.

## 2. XML Transformation (The Injection Pipeline)
Before the notes are rendered, the "raw" XML undergoes several transformations in `src/MusicXML/musicXmlTransform.ts` to tailor it for a harmonica player:

- **Filtering:** To keep the display clean, the app typically isolates the first part (`<part>`) and the first staff (`<staff>`) of the score.
- **Transposition:** If the user adjusts the transpose setting, the `writePitch` function programmatically updates the pitch elements within the XML DOM.
- **Tab Injection:** The `injectHarmonicaTabs` function calculates the specific harmonica hole and action (blow, draw, bend) for every note based on the selected harmonica key. These are injected directly into the XML as `<fingering>` elements within the `<notations>` block.

## 3. Rendering with OpenSheetMusicDisplay (OSMD)
HarpTrainer uses the **OpenSheetMusicDisplay** library to turn the transformed XML into a visual staff.

- **Container Binding:** A React `useRef` provides a DOM element for OSMD to attach to.
- **Loading:** The `osmdInstance.load(xml)` method parses the transformed XML string into a musical object model.
- **Rendering:** The `.render()` method converts the musical model into high-quality **SVG elements**. This allows the sheet music to be responsive and crisp at any zoom level.

## 4. Playback and Cursor Synchronization
The visual staff is synchronized with the audio engine in real-time:

- **Playback Parsing:** Simultaneously, the XML is analyzed by `parsePlaybackEvents` to create a chronological list of notes, rests, and repeats with precise millisecond timestamps.
- **Cursor Management:** During playback, the application tracks the elapsed time. When a note boundary is crossed, it triggers `osmdInstance.current.cursor.next()`.
- **Visual Styling:** The `styleSheetCursor` function is used to customize the appearance of the OSMD cursor (color, opacity, and transition) to match the HarpTrainer theme.

## 5. Performance and Optimization
Since OpenSheetMusicDisplay is a large library (over 1MB), HarpTrainer uses **Vite's manual chunks** configuration:

- **Code Splitting:** The renderer and its dependencies (like VexFlow) are bundled into a separate vendor chunk (`osmd-*.js`).
- **Lazy Loading:** The entire MusicXML route is lazy-loaded, ensuring that users who only use the Harmonica visualizer or Circle of Fifths don't have to download the heavy notation engine.

---
*For source implementation, see:*
- `src/MusicXML/MusicXML.tsx` (Core coordinator)
- `src/MusicXML/musicXmlTransform.ts` (XML Logic)
- `src/MusicXML/audioPlayback.ts` (Audio synchronization)
