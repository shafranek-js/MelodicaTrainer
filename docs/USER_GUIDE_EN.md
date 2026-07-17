# MelodicaTrainer User Guide

MelodicaTrainer helps you practice melodica: it shows a virtual keyboard, listens through your microphone, checks pitch accuracy, plays scores, and turns score notes into a falling-note `Tabs` practice view.

The app has four main sections:

| Section | What it is for |
| --- | --- |
| `Melodica` | Check the pitch you play and see it on a virtual melodica keyboard. |
| `Tabs` | Load MusicXML/MXL/Guitar Pro files, start playback, and practice with Note Highway. |
| `Practice` | Train scales, individual notes, chord tones, and 12-bar blues. |
| `Circle` | Explore the circle of fifths, modes, scales, and triads. |

## Common Controls

The top menu opens `Circle`, `Melodica`, `Tabs`, `Practice`, and `Help`.

The `A-B-C` switch changes note display between letter names and solfege. This only changes labels; the musical calculations stay the same.

The app uses your microphone in `Melodica`, `Practice`, and `Tabs`. The browser will ask for permission the first time listening starts. If microphone access is denied, pitch detection will not work and the app will show an error.

Some settings are saved in your browser: melodica range, tempo, SoundFont, display mode, pinned panels, and the loaded score. If the app behaves unexpectedly after old experiments, manually changing the setting or reloading the page is usually enough.

## Melodica

Use `Melodica` for quick pitch checking.

1. Choose `Melodica range`.
2. Click `Start listening`.
3. Allow microphone access if the browser asks.
4. Play a note on your melodica.
5. Watch `Detected note` and the highlighted key.

Main controls:

| Control | What it does |
| --- | --- |
| `Melodica range` | Selects the keyboard size: 25, 27, 32, 37, or 44 keys. The 44-key option matches the Hammond 44 range (C3-G6). |
| `Start listening` / `Stop listening` | Turns microphone listening on or off. |
| `Detected note` | Shows the detected note. |
| `cents` | Shows how far the note is above or below exact pitch. |
| `clarity` | Shows how confident the pitch detection is. |

If the tuning line on the key is offset, the note is out of tune. A value near `0 cents` means good intonation. A positive value means the note is sharp; a negative value means it is flat.

## Tabs

`Tabs` is the main score-practice workspace. By default it opens the `Aloutte` score.

### Loading A File

Click `Load XML/GP` and choose a file. Supported formats:

- `.xml`
- `.musicxml`
- `.mxl`
- `.gp`
- `.gp3`
- `.gp4`
- `.gp5`
- `.gpx`

MusicXML/MXL files are rendered with OpenSheetMusicDisplay. Guitar Pro files are rendered with alphaTab. In both cases, Note Highway is built from the parsed playback events.

Important: MusicXML playback/rendering focuses on the first relevant part/staff. Guitar Pro uses the selected `GP Track`.

### Left Panel

The left panel contains file and sound settings.

| Control | What it does |
| --- | --- |
| `Melodica Range` | Selects the range used for labels and Note Highway. |
| `SoundFont` | Selects the sound bank for playback. |
| `Instrument` | Selects an instrument inside the SoundFont, when available. |
| `GP Track` | Selects the Guitar Pro track. Only visible for GP files. |
| `Load XML/GP` | Loads a new file. |
| `XML` | Downloads the transposed MusicXML. Available for MusicXML files. |
| `Text` | Downloads a text list of melodica notes. Available for MusicXML files. |

### Playback

The top bar on the `Tabs` page shows playback controls:

| Control | What it does |
| --- | --- |
| `Play` | Starts playback. |
| `Pause` | Pauses playback. |
| `Resume` | Continues from the current position. |
| `Restart` | Returns the score to the beginning. |
| `-5 BPM` / `+5 BPM` | Decreases or increases tempo by 5 BPM. |
| tempo slider | Changes tempo manually. |
| `Hits`, `Miss`, `Streak`, `ACC` | Shows scoring stats. |

The bottom edge of the top menu also shows a song progress bar.

### Keyboard Shortcuts

Shortcuts work in `Tabs` when focus is not inside an input, select, or textarea.

| Shortcut | What it does |
| --- | --- |
| `Space` | Starts playback or pauses it. |
| `Escape` | Restarts the score from the beginning, like `Restart`. |
| `+` or `=` | Increases tempo by 5 BPM. |
| `-` or `_` | Decreases tempo by 5 BPM. |

### Note Highway

The center area shows Note Highway:

- falling blocks are notes you need to play;
- the horizontal line is the hit target;
- `Press play`, `Listening`, or the detected note shows microphone state;
- `Clarity` shows the current pitch-detection quality;
- colored flashes show successful hits.

A note counts as a hit when the detected pitch matches the target note as it crosses the target line. If the microphone is unavailable or the signal is too quiet, hits will not be scored.

### Right Panel

The right panel controls display and transposition.

| Control | What it does |
| --- | --- |
| `Transpose` | Shifts notes by the selected number of semitones. |
| `Reset transpose` | Returns transposition to `0`. |
| `Show Note Names` | Shows or hides note names on falling blocks. |
| `Fingering Guide` | Chooses fingering hints: `None`, `Numbers on notes`, or `Virtual hand`. |
| `Study Mode` | Waits on the target note until you play it. |
| `Optimize` | Searches for a transposition that fits the selected melodica range better. |

If `Optimize` shows a variant count, repeated clicks cycle through the available variants.

### Score And Settings Panels

On wide screens, `Tabs` has three panels:

- left settings panel;
- top score panel;
- right transpose/display panel.

`Pin panel`, `Unpin panel`, `Pin score`, and `Unpin score` pin or hide panels. If a panel is not pinned, move the mouse to the left, right, or top edge to show it temporarily.

The top menu can also be pinned or hidden with `Pin menu` / `Unpin menu`. If the menu is not pinned, move the mouse to the top edge of the window to show it temporarily.

### Mouse Actions

In the center area of `Tabs`:

| Action | What it does |
| --- | --- |
| Left click on Note Highway | Starts playback or pauses it. |
| Mouse wheel up | Increases tempo by 5 BPM. |
| Mouse wheel down | Decreases tempo by 5 BPM. |
| Right click / context menu on Note Highway | Pins all panels if they are hidden, or unpins all panels if they are already pinned. |
| Hover the left edge | Shows the left settings panel if it is not pinned. |
| Hover the right edge | Shows the right transpose/display panel if it is not pinned. |
| Hover the top score edge | Shows the top score panel if it is not pinned. |
| Hover the top window edge | Shows the top menu if it is not pinned. |

## Practice

Use `Practice` for targeted note and scale training.

1. Choose `Melodica range`.
2. Choose `Tonic`.
3. Choose `Scale`.
4. Choose a training mode.
5. Click `Start listening`.
6. Play the target notes and watch `Hit` / `Waiting`.

Modes:

| Mode | How to use it |
| --- | --- |
| `Explore` | Freely explore the keyboard; notes in the selected scale are highlighted. |
| `Notes` | The app chooses target notes from the selected scale. |
| `Scale` | Targets move through the scale in order. |
| `Chord tones` | Trains chord tones from the selected tonic. |
| `12-bar` | Shows 12-bar blues and the chord tones for the current bar. |

`Next target` changes the current target. In microphone-based modes, a hit is counted when the correct MIDI note is played with close enough intonation.

## Circle

`Circle` is for theory and orientation around keys.

Main actions:

- click a note on the outer circle to choose the root;
- choose a mode from the mode row;
- choose a scale from the scale row;
- read the selected scale, scale degrees, and triads in the lower panel.

Legend:

| Element | Meaning |
| --- | --- |
| cyan border | Tonic of the selected mode, the starting note. |
| numbers inside circle | Scale degrees. |
| green | Scale note. |
| yellow | Major triad. |
| blue | Minor triad. |
| red | Diminished triad. |
| dark/gray | No triad or unclassified quality. |

`Circle` does not use the microphone and does not depend on the selected melodica range.

## Troubleshooting

### Browser Denied Microphone Access

Check the site's browser permissions and allow microphone access. After changing permissions, reload the page and click `Start listening` or `Play` again.

### No Note Is Detected

Check that the microphone is enabled, the signal is loud enough, and the selected melodica range includes the note you are playing. A very quiet or noisy signal can produce low `clarity`.

### File Does Not Load

Check the file extension. `Tabs` supports MusicXML/MXL and Guitar Pro formats. If the file is damaged or does not contain a score, the app will show an error message.

### File Is Too Large

The app limits MusicXML/MXL file size. Use a smaller export or simplify the file in your notation editor.

### Playback Is Silent

Check system volume and browser-tab volume. Click `Play` after a score is loaded. If the selected SoundFont or Instrument does not sound right, try a different `SoundFont` or `Instrument`.

### Wrong GP Track

For Guitar Pro files, choose the correct part in `GP Track`. After changing the track, Note Highway and the score should rebuild for that part.

### Notes Do Not Fit The Melodica Range

In `Tabs`, try:

1. Change `Melodica Range`.
2. Click `Optimize`.
3. Adjust `Transpose` manually.
4. Click `Reset transpose` if you need to return to the original version.

### Stats Do Not Count Hits

Check the microphone, `clarity`, signal volume, and selected range. In `Study Mode`, playback waits for the correct note, so no movement usually means the expected note has not been detected yet.
