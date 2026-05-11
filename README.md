# 🪗 HarpTrainer - Advanced Harmonica Learning Tool

[👉 Try the Live Demo](https://shafranek-js.github.io/HarpTrainer/)

HarpTrainer is a comprehensive interactive application designed for harmonica players of all levels. It combines real-time pitch detection, music theory visualization, and a gamified learning experience to help you master the harmonica.

---

## 🧩 Key Features

### 🎙️ Real-Time Pitch Detection & Visualizer
- **Interactive Layout:** See exactly which hole and action (blow, draw, bend) you are playing on a virtual harmonica.
- **High Precision:** Uses advanced frequency estimation to show your accuracy in cents — perfect for mastering precise bends.
- **Multi-Key Support:** Instantly switch between any harmonica key (C, G, A, D, Bb, etc.) and the layout updates automatically.

### 🛣️ Note Highway (MusicXML Interactive Practice)
- **Gamified Learning:** Practice songs with a "Note Highway" interface. Play the notes in real-time as they approach the target zone.
- **MusicXML Support:** Load any MusicXML file to see standard notation synced with harmonica tablature.
- **Smart Transposition:** Automatically transpose songs to fit your harmonica's key, with filters to avoid impossible notes (like overblows or specific bends).
- **Scoring System:** Get instant feedback on your performance with hit detection, streaks, and overall accuracy percentages.

### 🌀 Circle of Fifths & Music Theory
- **Interactive Theory:** Explore scales, modes, and chords visually.
- **Harmonica Integration:** Understand how positions and scales map to your instrument.

### 🎯 Practice Mode
- **Targeted Training:** Dedicated mode for practicing specific intervals, bends, and accuracy targets to build muscle memory.

---

## 🛠️ Technical Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Audio Engine:** [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) + [SpessaSynth](https://github.com/spessas/SpessaSynth) (SoundFont synthesis)
- **Pitch Detection:** [pitchy](https://www.npmjs.com/package/pitchy)
- **Notation:** [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/)
- **Animations:** [GSAP](https://greensock.com/gsap/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- A microphone (for pitch detection features)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/shafranek-js/HarpTrainer.git
   cd HarpTrainer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

---

## 📖 Related Documentation

- [Pitch Detection Logic](./PITCH_DETECTION_LOGIC.md) - Detailed technical explanation of the audio processing pipeline.
- [App Improvement Plan](./APP_IMPROVEMENT_PLAN.md) - Roadmap and planned future enhancements.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
