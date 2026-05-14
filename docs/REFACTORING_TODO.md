# Refactoring TODO

Рабочий чеклист для поэтапного рефакторинга NoteBender/HarpTrainer. Обновлять после каждого завершенного шага.

## 0. Stabilization
- [x] Зафиксировать текущие незакоммиченные кодовые изменения отдельным коммитом после проверки.
- [x] Разобраться с untracked файлами: оставить пользовательские `.gp`, `.bat`, `.png` вне commit.
- [x] Закрыть текущие `eslint react-hooks/exhaustive-deps` warnings в `MusicXML.tsx`.
- [x] Проверить `npm run lint`.
- [x] Проверить `npm run build`.
- [x] Проверить node-only релевантные тесты MusicXML/playback через `npm run test:node`.

## 1. Tempo Model
- [x] Разделить `detectedTempoBpm` и `userTempoBpm`; override определяется наличием `userTempoBpm`.
- [x] Оставить localStorage только для пользовательского tempo override.
- [x] Сброс override при загрузке нового файла, если нет явного режима keep manual tempo.
- [x] Добавить тесты для XML tempo, GP tempo, manual override и reload behavior.

## 2. Split MusicXML Route
- [x] Вынести загрузку файлов в `useScoreFileLoader`.
- [x] Вынести playback lifecycle в `useScorePlayback`.
- [x] Вынести GP state и alphaTab callbacks в `useGpScore`.
- [x] Вынести OSMD render/cursor lifecycle в `useOsmdScore`.
- [x] Вынести sidebar UI в `ScoreSettingsPanel` и `TransposeControls`.

## 3. AlphaTab / GP Adapter
- [x] Вынести alphaTab settings builder в `alphaTabSettings.ts`.
- [x] Вынести настройку track/staff notation view в отдельный helper.
- [x] Типизировать alphaTab event adapter, уменьшить касты в React-компоненте.
- [x] Покрыть GP parser тестами: tempo automations, rests, ties, multi-voice.

## 4. Note Highway
- [x] Вынести расчет геометрии блоков в `noteHighwayLayout.ts`.
- [x] Вынести lane/hole/tab width logic из React-компонента.
- [x] Добавить тесты для bends, overblow/draw, connected shapes, tied note height.

## 5. Playback And Scoring
- [x] Проверить актуальность `audioPlayback.ts` после перехода на SpessaSynth.
- [x] Удалить dead code или восстановить покрытые тестами сценарии.
- [x] Разделить hit detection и React state updates в scoring.
- [x] Добавить тесты на misses, rests, chords, repeated notes, zero-duration edge cases.

## 6. Shared Domain Helpers
- [x] Разделить `utils.ts` на `harmonicaLayout.ts`, `pitch.ts`, `noteNaming.ts`.
- [x] Временно сохранить backward-compatible exports.
- [x] Обновить тесты вокруг harmonica layout и pitch helpers.

## 7. App Shell
- [x] Заменить передачу большого `MenuProps` через `App.tsx` на `PlaybackToolbarContext`.
- [x] Сделать `Menu` чистым shell-компонентом.
- [x] Не менять `HashRouter` и base `/HarpTrainer/`.

## 8. Persistent State
- [x] Добавить versioned schema для localStorage keys.
- [x] Добавить sanitizer для устаревших/битых значений.
- [x] Ввести лимит или предупреждение для хранения больших GP/MXL файлов.

## 9. Test Infrastructure
- [x] Разобраться с `jsdom@29` / `html-encoding-sniffer` ESM-конфликтом.
- [x] Разделить scripts на `test:node` для pure helpers и `test:dom` для DOM/React.
- [x] Добавить smoke tests для XML и GP parser без браузера.

## 10. Runtime Lifecycle Refactoring
- [x] Закрыть known runtime bugs из code review: stale playback timeout, AlphaTab pre-play scroll, noteOff timers, SoundFont race, pitch cleanup guard.
- [x] Вынести AlphaTab track selection/render helpers из `AlphaTabViewer.tsx`.
- [x] Вынести AlphaTab auto-fit math/measurement helpers из `AlphaTabViewer.tsx`.
- [x] Добавить focused tests для вынесенных AlphaTab helpers.
- [x] Вынести cursor sync из `MusicXML.tsx` в отдельный hook.
- [x] Сузить обязанности `audioPlayback.ts` до явного synth service API.
- [x] Уменьшить debug logging или завести controlled debug flag.
- [x] После каждого шага запускать targeted tests, `npm run lint`, `npx tsc -b`, `npm run build`.

## 11. Route Orchestration Refactoring
- [x] Вынести transpose optimizer state/actions из `MusicXML.tsx`.
- [x] Вынести score download actions из `MusicXML.tsx`.
- [x] Вынести soundfont/preset warmup и live instrument sync из `MusicXML.tsx`.

## 12. Score Pipeline Refactoring
- [x] Вынести XML transform/render/playback parsing pipeline из `MusicXML.tsx`.
- [x] Вынести file import/reset flow из `MusicXML.tsx`.
- [x] Вынести derived playback/highway view model из `MusicXML.tsx`.
- [x] Проверить `MusicXML.tsx` на оставшиеся route-level обязанности и не дробить UI без практической пользы.
