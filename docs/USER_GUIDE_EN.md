# MelodicaTrainer User Guide

MelodicaTrainer helps you practice melodica: it shows a virtual keyboard, listens through your microphone, checks pitch accuracy, plays scores, and turns score notes into a falling-note `Tabs` practice view.

The app has four practice sections plus Help and Settings:

| Section | What it is for |
| --- | --- |
| `Melodica` | Check the pitch you play and see it on a virtual melodica keyboard. |
| `Tabs` | Load MusicXML/MXL/MSCZ/Guitar Pro/MIDI files, start playback, and practice with Note Highway. |
| `Practice` | Train scales, individual notes, chord tones, and 12-bar blues. |
| `Circle` | Explore the circle of fifths, modes, scales, and triads. |
| `Help` | Read this guide and troubleshoot common problems. |
| `Settings` | Connect and manage a private score-library folder on your device. |

## Common Controls

The top menu opens `Circle`, `Melodica`, `Tabs`, `Practice`, and `Help`. The gear button opens `Settings`.

The `A-B-C` switch changes note display between letter names and solfege. This only changes labels; the musical calculations stay the same.

The app uses your microphone in `Melodica`, `Practice`, and `Tabs`. The browser will ask for permission the first time listening starts. If microphone access is denied, pitch detection will not work and the app will show an error.

Some settings are saved in your browser: melodica range, tempo, SoundFont, display mode, pinned panels, and the loaded score. A connected score-library folder and its local index are stored separately in the browser's IndexedDB storage. If the app behaves unexpectedly after old experiments, manually changing the setting or reloading the page is usually enough.

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

Click `Load XML/GP/MIDI/MSCZ` and choose a file. Supported formats:

- `.xml`
- `.musicxml`
- `.mxl`
- `.mscz`
- `.gp`
- `.gp3`
- `.gp4`
- `.gp5`
- `.gpx`
- `.mid`
- `.midi`

MusicXML/MXL files are rendered with OpenSheetMusicDisplay. MSCZ files are converted locally to MusicXML first and then use the same rendering and practice pipeline. Guitar Pro files are rendered with alphaTab. MIDI files show approximate sheet-music notation generated from the selected part and quantization setting. In every case, Note Highway is built from the parsed playback events.

MSCZ conversion happens entirely in the browser; the file is not uploaded. MuseScore-specific layout or playback details may not have a MusicXML equivalent. The app blocks files when notes or durations are lost, and shows a warning when only non-critical notation details were simplified. After a blocked conversion or a warning, `Try high-fidelity conversion` can load an optional MuseScore 4.0 compatibility engine of about 18 MB. It is downloaded only after your click and still processes the file locally.

Choose the practice `Part` for MusicXML/MXL/MSCZ, Guitar Pro, and MIDI. A two-staff keyboard part also provides a `Hand` selector. Only the selected part or hand is rendered, shown in Note Highway, and used for scoring. MIDI channel 10 drums are excluded.

When the score contains other playable parts, `Background accompaniment` plays them quietly with the same SoundFont and Instrument. Its slider controls all hidden parts from `Muted` to `100%` and is saved in this browser. Background notes follow tempo, pause, loop, transpose, and Study Mode, but never count as hits or misses.

### Left Panel

The left panel contains file and sound settings.

| Control | What it does |
| --- | --- |
| `Melodica Range` | Selects the range used for labels and Note Highway. |
| `SoundFont` | Selects the sound bank for playback. |
| `Instrument` | Selects an instrument inside the SoundFont, when available. |
| `Part` | Selects the MusicXML/MSCZ part, Guitar Pro track, or melodic MIDI channel. |
| `Hand` | Selects the right or left staff of a two-staff keyboard part. |
| `Background accompaniment` | Sets the volume of hidden playable parts. Only visible when accompaniment is available. |
| `Notation grid` | Chooses automatic or fixed quantization for approximate MIDI notation. Only visible for MIDI files. |
| `Load XML/GP/MIDI/MSCZ` | Loads a new file. |
| `Browse library` | Opens public scores and files indexed from your private folder. |
| `XML` | Downloads the transposed MusicXML. Available for MusicXML files. |
| `Text` | Downloads a text list of melodica notes. Available for MusicXML files. |

### Score Library

Click `Browse library` to open the combined score library.

- `Public` contains the built-in public-domain and CC0 collection.
- `My files` contains supported files found in the folder selected in `Settings`.
- Click the star on any public or local score to add it to `Favourites`. The selection is saved in this browser.
- Choose `Favourites` in the source filter to show only starred scores.
- Use the source, format, difficulty, and tag filters to narrow the list. Local scores can use the same difficulty and tag filters as public scores.
- Local entries have a `LOCAL` badge and are opened directly from your device; they are not downloaded from or uploaded to a server.
- On a local score, use the pencil button to set its difficulty and tags. These labels stay in this browser and survive folder rescans.
- Use the trash button to delete a local file. The app shows the exact relative path and asks for confirmation because deletion from the selected folder cannot be undone.

Before a folder is configured, the library shows `Set up local library`. After the folder is connected, it shows `Add files` and `Refresh`.

`Add files` copies selected MusicXML/MXL, MSCZ, Guitar Pro, or MIDI files into the root of the connected folder. Exact duplicates are skipped. If a different file already uses the same name, the new file is saved with a suffix such as `Song (2).mxl`.

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

## Settings And Local Library

Open the gear button in the top menu to manage `My score library`.

### Connecting A Folder

1. Open `Settings`.
2. Click `Choose local library folder`.
3. Select any folder you can access on your computer or external drive.
4. Approve read-and-write access when the browser asks.
5. Open `Tabs` and click `Browse library`, then choose `My files`.

The browser only shares the selected folder's name with the page, so MelodicaTrainer does not display its full system path.

Persistent folder access requires a browser with the File System Access API, such as current desktop Chrome or Edge. In other browsers, `Load XML/GP/MIDI/MSCZ` still works for opening one file at a time, but the app cannot remember and rescan a normal folder.

### Adding And Organizing Files

The folder and all its subfolders are scanned recursively for:

- MusicXML: `.xml`, `.musicxml`, `.mxl`
- MuseScore: `.mscz`
- Guitar Pro: `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`
- MIDI: `.mid`, `.midi`

You can organize files in subfolders and copy files into the folder manually while MelodicaTrainer is closed. The app rescans when it starts, when the score library opens, when the browser tab becomes active, and when supported browsers report a folder change. Use `Rescan` in Settings or `Refresh` in the library whenever you want an immediate check.

In `Browse library`, the pencil button on each local score lets you assign `Beginner`, `Intermediate`, or `Advanced` difficulty and up to 20 custom tags. The metadata is stored in the browser's local index, not written into your score file. It is preserved when the file changes or is renamed and the app can match it by path or file hash.

The trash button permanently removes the selected file from the connected folder after a confirmation step. It removes only that file, never its parent folder or public catalog entries. `Disconnect` remains non-destructive and only forgets browser access and the local index.

Files larger than 10 MB, damaged files, and unsupported formats are not added as playable entries. Settings lists any file problems found during a scan. One bad file does not stop other files from being indexed.

### Folder Controls And Privacy

| Control | What it does |
| --- | --- |
| `Reconnect` | Requests access again when the browser no longer grants permission. |
| `Rescan` | Checks the folder immediately and reports added, updated, removed, skipped, and invalid files. |
| `Change folder` | Selects a different folder and builds a new local index. |
| `Disconnect` | Forgets the folder and local index in this browser. It never deletes files from disk. |

The folder handle and local index stay in IndexedDB on this browser and device. Score contents stay on your device and are never uploaded by the local-library feature. Folder settings do not synchronize to another browser or computer.

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

Check the file extension. `Tabs` supports MusicXML/MXL, MSCZ, Guitar Pro, and `.mid/.midi` SMF 0/1 files. If the file is damaged or does not contain playable notes, the app will show an error message.

### MSCZ Conversion Fails Or Shows A Warning

MSCZ is MuseScore's native archive format, so some editor-specific information cannot be represented exactly in MusicXML. A warning means the playable score was loaded but some non-critical notation was simplified. You can click `Try high-fidelity conversion` after a warning or a blocked conversion. This opt-in fallback downloads an approximately 18 MB engine based on MuseScore 4.0, converts locally, and validates that playable notes exist before replacing the current score. The fallback cannot diagnose partial notation loss and may not understand features added by later MuseScore 4 releases, so review its result. If it also fails or the score is complex, open the file in MuseScore Desktop and use `File` → `Export` to create a MusicXML or MXL file, then load that export instead.

### Local Folder Cannot Be Selected

Use a current desktop version of Chrome or Edge and open MelodicaTrainer over HTTPS or localhost. If folder access is unavailable, use `Load XML/GP/MIDI/MSCZ` to open files individually.

### Local Folder Needs Permission Again

Browsers can revoke folder access after tabs are closed or site permissions change. Open `Settings` and click `Reconnect`, then approve read-and-write access. MelodicaTrainer cannot request this permission silently; it requires your click.

### A File Does Not Appear In My Files

Check that the file is inside the connected folder or one of its subfolders and uses a supported extension. Then click `Rescan` in Settings. Look under `file problems` for invalid or oversized files. An exact duplicate of another indexed file is intentionally skipped.

### File Is Too Large

The app limits score, MSCZ, and MIDI files to 10 MB. The unpacked MSCX score inside an MSCZ file also has a 10 MB limit. Use a smaller export or simplify the file in your editor.

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
