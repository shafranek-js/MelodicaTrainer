# Code Review: MelodicaTrainer

**Date:** 2026-05-15  
**Summary:** 122 tests passing, lint clean, build successful. The codebase is generally well-structured with strong TypeScript discipline, good separation of pure logic from UI, and solid error handling. Below are findings organized by severity and area.

---

## ✅ Strengths

1. **TypeScript rigor** — `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` all enabled. Good use of `satisfies`, discriminated unions for errors, and `as const` for exhaustive arrays.

2. **Domain modeling** — `melodicaLayout.ts` and `harmonicaLayout.ts` are clean, testable, pure-function implementations. Tonal.js is used consistently instead of ad-hoc note math.

3. **MusicXML pipeline** — Parsing → transformation → rendering chain is well-separated. XML is handled exclusively through `DOMParser`/`XMLSerializer`. Tie resolution, repeat expansion, key signature transposition are all correctly implemented.

4. **Pitch detector hook** — Proper Web Audio lifecycle, RMS gating, stable-frame filtering, and thorough cleanup. Handles `AudioContext` suspension, cancelled async operations, and browser compatibility.

5. **Persistent state** — Versioned envelope pattern for localStorage with Uint8Array encoding support and sanitize-based deserialization. Well thought out.

6. **SoundFont playback** — Generation-based cancellation prevents race conditions during async init. Clean timeout management for note-off scheduling.

7. **Test coverage** — 122 tests across 27 files, targeting pure logic (parsers, transforms, scoring, tempo model, layout generators). DOM-dependent tests separated from DOM-independent ones.

---

## 🔴 Critical Issues

### 1. Component named `TestFileLoader` instead of `MusicXML`

**File:** `src/MusicXML/MusicXML.tsx`, lines 72 and 405

The main exported component is named `TestFileLoader` — a development placeholder that was never renamed. This leaks into React DevTools and stack traces.

**Fix:** Rename to `MusicXML` or `Tabs`.

---

### 2. localStorage keys still use the `harptrainer_` prefix

**Files:** `src/MusicXML/MusicXML.tsx` lines 76–85

```
harptrainer_transpose
harptrainer_show_note_names
harptrainer_user_tempo
harptrainer_soundfont
harptrainer_preset
```

And `debugLogger.ts` line 1: `harptrainer_debug_logs`

All should be migrated to `melodicatrainer_` to match the new app identity. Changing these will invalidate existing user state, so a migration path or at minimum a comment documenting the switch is needed.

---

### 3. `noteHighwayLayout.ts` has dead code — bend/overblow never rendered

**File:** `src/MusicXML/noteHighwayLayout.ts`, lines 148–149

```typescript
const isOverblow = false;
const bendDepth = 0;
```

The file exports `getBendDepth` and `getTargetWidthPct` which correctly compute bend depth and overblow state from tab strings, but the render data builder ignores them and hardcodes `false`/`0`. The `NoteHighway.tsx` component has full rendering code for bend arrows and overblow indicators (lines 147–166) that will never fire.

This is likely leftover from the harmonica→melodica migration. Either remove the dead rendering code or properly compute these values from the melodica tab format.

---

### 4. `Harmonica.tsx` is dead code

**File:** `src/Harmonica/Harmonica.tsx` (224 lines)

The route `/harmonica` redirects to `/melodica` (App.tsx line 35). The `Harmonica` component is never rendered. It imports from `harmonicaLayout.ts`, `usePitchDetector`, etc. — dead code that bloats the build.

---

## 🟡 Medium Issues

### 5. `findBestTransposeIntervals` is O(N²) — layout generated per iteration

**File:** `src/MusicXML/musicXmlTransform.ts`, lines 319–368

Each interval iteration calls `getHarmonicaHoleForNote(selectedKey, transposedNoteName)` which internally calls `generateLayout(key)` — regenerating the full layout 73 times. Move `generateLayout(selectedKey)` outside the interval loop.

Same applies to `findBestMelodicaTransposeIntervals` (lines 417–444) where `generateMelodicaLayout(keyCount)` is correctly placed outside the loop, but the harmonica counterpart is not.

---

### 6. AudioContext recreated on every enable toggle

**File:** `src/hooks/usePitchDetector.tsx`, line 75

Each time `isListening` changes to `true`, a new `AudioContext` is created. Browsers limit AudioContext instances and creating them unnecessarily can cause issues. Consider keeping the context alive and just toggling the stream.

---

### 7. SoundFont preset polling has no timeout

**File:** `src/MusicXML/audioPlayback.ts`, lines 131–136

The loop polls up to 50 times × 100ms = 5 seconds waiting for presets. If presets never appear (malformed SF, library change), the init promise hangs indefinitely. Add a hard timeout that rejects with a descriptive error.

---

### 8. Playback uses `setTimeout` for note-off scheduling

**File:** `src/MusicXML/audioPlayback.ts`, lines 225–231

`setTimeout` has ~4ms minimum granularity and is susceptible to browser throttling (especially in background tabs). Ideally, note-off should be scheduled via SpessaSynth's built-in scheduling or using `AudioContext.currentTime`-based scheduling. This may be a library limitation, but the drift in timing is noticeable for faster tempos.

---

### 9. `usePlaybackToolbarState` returns `{}` when context is null

**File:** `src/Menu.tsx`, line 22

```typescript
const tabsState = usePlaybackToolbarState();
const { isPlaying, isPaused, ... } = tabsState ?? {};
```

This pattern means every property defaults to `undefined`, and the guarding logic uses `onTogglePlayback &&` checks. This works but is fragile — if a new caller forgets the `??` fallback, it crashes. Consider making the hook return a non-nullable state object with sensible defaults when no toolbar state is registered.

---

### 10. No React error boundary

A crash in any route component (MusicXML, Practice, Circle, Melodica) will unmount the entire app. Add an error boundary around `<Routes>` or individual routes in `App.tsx`.

---

### 11. Magic numbers

| Location | Value | What it means |
|---|---|---|
| `playbackTimeline.ts:57` | `250` | Shortest note duration fallback |
| `playbackTimeline.ts:60` | `40` | Pixels-per-shortest-note ratio |
| `noteHighwayLayout.ts:131` | `0.4` | Vertical offset for non-scoop notes |
| `MusicXML.tsx:168` | `100` | Tempo scaling denominator |
| `noteHighwayLayout.ts:52–58` | `4.0`, `8.4`, `11`, `6.5`, `4.8`, `3.0` | Target width percentages |

These should be named constants, ideally in `constants.ts`.

---

## 🟢 Minor / Style

### 12. Misleading function names post-migration

- `replaceHarmonicaFingering` in `musicXmlTransform.ts` is now used for melodica key labels — rename to `replaceFingeringText` or `injectTabLabel`.
- `tabsState` in `Menu.tsx` — the page is called "Tabs" in the UI but could be more descriptive.
- `tabsState` is tangentially related to the menu — it's really the playback state.

### 13. Duplicated logic in `injectHarmonicaTabs` / `injectMelodicaLabels`

**File:** `src/MusicXML/musicXmlTransform.ts`, lines 284–403

These two functions are structurally identical — they both transpose notes, rewrite pitch elements, and inject tab/fingering text. The only difference is the tab source function (`getHarmonicaHoleForNote` vs `getMelodicaKeyLabelForNote`). This could be unified with a strategy parameter.

### 14. `writePitch` doesn't handle `Note.get` returning empty

**File:** `src/MusicXML/musicXmlTransform.ts`, lines 200–231

```typescript
const note = Note.get(noteName);
if (note.empty || note.oct === undefined) return;
```

The guard is correct, but callers of `writePitch` do not check whether it succeeded. If `Note.get` returns empty, the pitch is silently not written, and the note keeps its original pitch while other notes in the measure get transposed — creating dissonance. Consider logging a warning or propagating the failure.

### 15. Dead `Harmonica.tsx` imports inflate bundle

**File:** `src/Harmonica/Harmonica.tsx`

The unreachable `Harmonica` component imports `harmonicaLayoutDisplayRows`, `harmonicaKeys`, `generateLayout`, `getLayoutMidiNumbers`, and type `HarmonicaLayoutDisplayRowKey` / `TonalNote`. Tree-shaking should eliminate them, but removing the dead component entirely is cleaner and guarantees zero bundle impact.

### 16. `package.json` redundant scripts

```json
"start": "vite",
"dev": "vite",
```

Both identical. Drop `start` unless needed for a specific deployment platform.

### 17. Build chunk size

OSMD chunk: **1.17 MB**, MusicXML chunk: **1.47 MB**. The warning is expected for these libraries, but the MusicXML chunk includes SpessaSynth which could potentially be lazy-loaded since it's only needed during playback.

---

## 📊 Summary

| Category | Count |
|---|---|
| Critical (dead code / naming / bugs) | 4 |
| Medium (performance / robustness) | 7 |
| Minor (style / cleanup) | 6 |
| **Total findings** | **17** |

**Overall assessment:** The codebase is in good shape — the tests are comprehensive, the TypeScript discipline is excellent, and the architecture is sound. The main issues are migration artifacts (old names, dead code, hardcoded values) that should be cleaned up as the melodica migration is finalized. All 122 tests pass, lint is clean, and the build succeeds.
