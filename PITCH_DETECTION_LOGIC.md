# Harmonica Pitch Detection Logic in HarpTrainer

This document explains the technical principles and the pipeline used to recognize harmonica notes in real-time.

## 1. Sound Capture (Web Audio API)
The process begins with the **Web Audio API**. The application requests access to the user's microphone using `navigator.mediaDevices.getUserMedia()`. 
- **AnalyserNode:** A specialized node is created to extract data from the audio stream in real-time.
- **Sample Rate:** The system typically operates at the hardware's native sample rate (e.g., 44.1kHz or 48kHz).

## 2. Frequency Estimation (`pitchy` library)
HarpTrainer uses the **pitchy** library for high-accuracy pitch estimation. Unlike simple FFT (Fast Fourier Transform), which can be imprecise for musical notes, `pitchy` implements algorithms designed to find the fundamental frequency ($f_0$) even in complex harmonic signals.

## 3. Signal Filtering & Quality Control
Harmonicas produce a "bright" sound with many overtones, which can confuse standard tuners. To ensure stability, the following filters are applied:

### A. Clarity Threshold
The algorithm calculates a "clarity" score (0.0 to 1.0). 
- If clarity is below a certain threshold (e.g., **0.82**), the signal is treated as background noise and ignored.
- Only "confident" signals trigger note detection.

### B. Minimum Volume (RMS)
To prevent the microphone from picking up faint distant sounds, a minimum **Root Mean Square (RMS)** threshold is set. If the signal is too quiet, it is discarded.

### C. Frame Stability
A "Stability Counter" ensures that a note is only recognized if the same frequency is detected for multiple consecutive frames (typically **2 stable frames**). This prevents flickering or "ghost notes."

## 4. Musical Translation
Once a stable frequency (in Hz) is confirmed, it is converted into musical data:

1.  **Note Mapping:** The frequency is mapped to the nearest MIDI note number using a logarithmic scale ($12 \times \log_2(f / 440) + 69$).
2.  **Cents Deviation:** The difference between the detected frequency and the "perfect" frequency of the note is calculated in **cents** (1/100th of a semitone). This is crucial for visualizing **bends**.

## 5. Harmonica Layout Mapping
The detected musical note (e.g., **G4**) is compared against the active **Harmonica Layout**:

- The system looks up the current harmonica key (e.g., **Key of C**).
- It checks the predefined layout for that key:
    - **Blow?** (Is G4 on hole 2 blow?)
    - **Draw?** (Is G4 on hole 3 draw?)
    - **Bend?** (Is G4 a half-step bend on hole 3 draw?)
- Once the physical action is identified, the corresponding UI element is highlighted.

## 6. Integration with Note Highway
During "Tabs" playback, the system constantly compares the **Detected Note** with the **Target Note** falling on the highway:
- If the detected MIDI note matches the target MIDI note within a specific time window (**140ms**), a **"Hit"** is recorded.
- Visual feedback is triggered (green flash), and statistics (streak, accuracy) are updated.

---
*For source implementation, see:*
- `src/hooks/usePitchDetector.tsx` (Core detection hook)
- `src/utils/utils.ts` (Frequency to Note conversion)
- `src/MusicXML/useNoteHighwayScoring.tsx` (Game logic)
