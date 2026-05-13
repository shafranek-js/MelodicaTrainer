# 🎯 Understanding the Clarity Indicator in HarpTrainer

The **Clarity** indicator is a vital metric in HarpTrainer's pitch detection system. It represents the "confidence level" of the audio analysis, helping the application distinguish between a musical note played on a harmonica and background noise or unstable signals.

---

## 1. What is Clarity?
Clarity is a numerical value between **0.0 and 1.0**. 
- **1.0 (Maximum):** A perfectly clean, stable periodic waveform (like a pure sine wave).
- **0.0 (Minimum):** Random noise (like static or silence).

HarpTrainer uses the **Pitchy** library, which employs autocorrelation-based algorithms to estimate the fundamental frequency ($f_0$). The "clarity" score reflects how well the detected period matches the rest of the signal.

## 2. Why is it Necessary?
Harmonicas are complex instruments with rich overtones and "chiff" (the initial breathy noise when a note starts). Without a clarity threshold:
- **Ghost Notes:** The app might display random notes from background conversation, fans, or street noise.
- **Instability:** During the attack or decay of a note, the frequency might fluctuate wildly. Clarity filtering ensures only the "stable" core of the note is registered.

## 3. The Magic Number: 0.82
In HarpTrainer, the default threshold for clarity is set to **0.82** (in `MusicXML.tsx`).
- If `Clarity < 0.82`: The signal is discarded. The app treats it as silence or noise.
- If `Clarity >= 0.82`: The signal is considered a potential musical note.

## 4. How it Works with Other Filters
Clarity is just one part of the **Detection Pipeline** in `usePitchDetector.tsx`:

1.  **RMS Gate:** First, the signal must be loud enough (RMS > 0.012).
2.  **Clarity Gate:** Then, the clarity must be high enough (Clarity > 0.82).
3.  **MIDI Filter:** The note must be within the expected range for a harmonica.
4.  **Stability Buffer:** The same note must persist for **2 consecutive frames** before it is displayed on the UI.

## 5. Tips for Players
If you find that your notes aren't being detected:
- **Check Your Tone:** "Airy" or weak playing reduces clarity. Focus on a clean, centered breath.
- **Background Noise:** Loud environments lower the relative clarity of your instrument.
- **Distance:** Being too far from the microphone reduces the signal-to-noise ratio, dropping clarity below the 0.82 threshold.

---
*For source implementation, see:*
- `src/hooks/usePitchDetector.tsx` -> `detectedClarity`
- `src/MusicXML/MusicXML.tsx` -> `minClarity` threshold parameter
