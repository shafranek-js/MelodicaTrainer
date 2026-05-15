# План миграции HarpTrainer на мелодику

## Исходное задание

Нужно заменить музыкальный инструмент "Губная гармошка" на новый инструмент - "Мелодика".

Основные типы мелодик:

- 32 клавиши, 2.5 октавы: основной вариант для начинающих.
- 37 клавиш, 3 октавы: вариант для более сложных произведений.
- 25-27 клавиш: компактные модели для детей или путешествий.

Нужно решить судьбу разделов `Circle`, `Harmonica`, `Practice`: переделать под мелодику или убрать.

Для звучания указан ресурс:

```text
C:\Projects\MelodicaTrainer\public\melodica_vib
```

## Ключевое решение

Не убирать существующие разделы, а переосмыслить их под мелодику:

- `Harmonica` заменить на `Melodica`: визуальная клавиатура, выбор диапазона 25/27/32/37 клавиш, live pitch detection.
- `Practice` оставить и адаптировать под мелодику: гаммы, интервалы, аккорды, точность попадания по нотам.
- `Circle` оставить как теоретический раздел, но убрать привязку к harmonica positions.
- `Tabs/MusicXML` оставить как главный практический модуль: загрузка MusicXML/GP, проигрывание, note-highway, микрофонный скоринг. Harmonica tab injection заменить или убрать.

## 1. Новая доменная модель инструмента

Создать новую модель, например `src/utils/melodicaLayout.ts`, вместо текущей модели диатонической гармошки в `src/utils/harmonicaLayout.ts`.

Модель должна описывать типы мелодик:

- `25 keys`: ориентировочно `F3-F5`.
- `27 keys`: ориентировочно `F3-G5`.
- `32 keys`: ориентировочно `F3-C6`, основной дефолт.
- `37 keys`: ориентировочно `F3-F6`.

Вместо holes / blow / draw / bends / overblow модель должна возвращать клавиши:

- MIDI number.
- Note name.
- Pitch class.
- Octave.
- White/black key.
- Keyboard index.
- Относительную позицию для UI.

Оставить без крупных изменений:

- `src/utils/pitch.ts`
- `src/hooks/usePitchDetector.tsx`

Они инструментально независимы и подходят для мелодики.

## 2. App shell и маршруты

Переименовать продуктовые элементы:

- `HarpTrainer` / `Harmonica` -> `MelodicaTrainer` / `Melodica`.
- `/harmonica` -> `/melodica`.
- Дефолтный маршрут `/` должен вести на `/melodica`.

Затрагиваемые файлы:

- `src/App.tsx`
- `src/Menu.tsx`
- `README.md`
- `KNOWLEDGE_BASE.md`
- `package.json`

Persistent storage keys можно мигрировать мягко: старые `harptrainer_*` не обязательно ломать сразу, но новые ключи лучше давать с префиксом `melodicatrainer_*` или нейтральным `trainer_*`.

## 3. Экран Harmonica -> Melodica

Переименовать:

- `src/Harmonica/Harmonica.tsx` -> `src/Melodica/Melodica.tsx`

Новый экран должен показывать:

- Piano-style клавиатуру выбранного диапазона.
- Выбор типа мелодики: 25, 27, 32, 37 клавиш.
- Подсветку текущей распознанной ноты.
- Точность попадания в cents.
- Разделение белых и черных клавиш.
- Состояния ошибки микрофона и низкой уверенности pitch detector.

Убрать:

- Выбор harmonica key.
- Blow/draw rows.
- Bend/overblow/overdraw визуализацию.
- 10-column hole grid.

## 4. Practice

Текущий `Practice` зависит от harmonica key, positions и bend targets. Для мелодики нужно заменить модель целей.

Оставить или добавить режимы:

- `Explore`: свободное распознавание нот на клавиатуре.
- `Note practice`: одиночные ноты из выбранной гаммы.
- `Scale practice`: восходящие и нисходящие гаммы.
- `Interval practice`: интервальные упражнения.
- `Chord tones`: трезвучия и септаккорды.
- `12-bar blues`: можно оставить, но без harmonica positions.

Убрать:

- `Bends`.
- Harmonica positions как обязательную механику.
- Blow/draw/bend labels.

Цели должны строиться из диапазона выбранной мелодики, а не из harmonica layout rows.

## 5. MusicXML / GP / Tabs

Текущий MusicXML pipeline внедряет harmonica fingering в XML через `injectHarmonicaTabs`.

Для мелодики есть два варианта:

1. Минимальный: убрать tab injection и показывать обычные note names / keyboard lanes.
2. Расширенный: заменить fingering на клавишные метки, например `C4`, `F#4`, или номера клавиш `1-32`.

Рекомендация: реализовать оба режима отображения:

- По умолчанию показывать названия нот.
- Дополнительно дать режим номеров клавиш выбранной мелодики.

Что изменить:

- `src/MusicXML/musicXmlTransform.ts`
- `src/MusicXML/useMusicXmlScore.ts`
- `src/MusicXML/useGpScore.ts`
- `src/MusicXML/useTransposeOptimizer.ts`
- `src/MusicXML/ScoreSettingsPanel.tsx`
- `src/MusicXML/TransposeControls.tsx`
- `src/MusicXML/useScoreDownloads.ts`

Что убрать или заменить:

- `HarpTabs export` -> `Melodica notes export`.
- `noOverblowOrDraw`.
- `noBend`.
- Harmonica key selector.

Новый auto-transpose должен искать транспозицию, при которой максимальное число нот попадает в выбранный диапазон мелодики.

## 6. Note Highway

Сейчас дорожки note-highway вычисляются из harmonica tabs через `getTabHole`, максимум 10 дорожек.

Для мелодики lanes должны быть клавишами выбранного диапазона:

- 25, 27, 32 или 37 дорожек.
- Для узких экранов нужна адаптивная ширина и горизонтальная прокрутка или масштабирование.
- Цвета лучше привязать к white/black key, active/hit/missed и опционально scale degree.

Затрагиваемые файлы:

- `src/MusicXML/NoteHighway.tsx`
- `src/MusicXML/noteHighwayLayout.ts`
- `src/MusicXML/playbackParser.ts`
- `src/MusicXML/playbackTimeline.ts`
- `src/MusicXML/usePlaybackViewModel.ts`
- соответствующие тесты в `src/MusicXML/*.test.ts`

Scoring можно оставить на базе MIDI и cents: эта часть уже подходит для мелодики.

## 7. Саундфонт

В `public/melodica_vib` лежит `.sfz` и набор `.wav`.

Текущий playback использует `spessasynth_lib`, который штатно работает с SoundFont-подобными банками:

- SF2
- SF3
- DLS
- SFOGG

Практичный путь:

1. Конвертировать `public/melodica_vib/melodica vib.sfz` + WAV samples в `melodica_vib.sf2` или `melodica_vib.sf3`.
2. Положить результат в `public/`.
3. Добавить его в список `SOUNDFONTS` в `src/MusicXML/MusicXML.tsx`.
4. Сделать мелодику дефолтным инструментом playback.

Если не конвертировать SFZ, придется писать отдельный SFZ/WAV sampler. Это больше работы и отдельный технический риск.

## 8. Circle

Раздел стоит оставить, потому что круг квинт полезен для мелодики.

Нужно изменить смысл:

- Убрать `harmonicaPosition` и `harmonicaOrder`.
- Оставить modes, scale degrees, triads, chord quality colors.
- Добавить опциональную подсветку нот, доступных в выбранном диапазоне мелодики.

Затрагиваемые файлы:

- `src/Circle/Circle.tsx`
- `src/Circle/circleTheory.ts`
- `src/Circle/circleTheory.test.ts`
- `src/Menu.tsx`, если меняется навигационное название.

## 9. Документация и тексты

Обновить все продуктовые упоминания:

- Harmonica
- HarpTrainer
- HarpTabs
- blow / draw / bend / overblow / overdraw
- harmonica key
- harmonica positions

Заменить на:

- Melodica
- MelodicaTrainer
- keyboard notes / key numbers
- melodica range
- scale / interval / chord practice

## 10. Тесты и валидация

Добавить тесты:

- `melodicaLayout`: диапазоны, MIDI, white/black keys, выбранный тип мелодики.
- MusicXML transform/export: отсутствие harmonica tabs или новый формат melodica labels.
- Auto-transpose: подбор транспозиции по диапазону мелодики.
- NoteHighway layout: lane mapping по MIDI/key index.
- Practice targets: цели в выбранном диапазоне.

Команды проверки:

```bash
npm test
npm run lint
npm run build
```

Для итераций по MusicXML использовать targeted tests, например:

```bash
npm test -- src/MusicXML/musicXmlTransform.test.ts
npm test -- src/MusicXML/playbackTimeline.test.ts
npm test -- src/MusicXML/noteHighwayLayout.test.ts
```

## Рекомендованный порядок реализации

1. Создать `melodicaLayout` и покрыть его тестами.
2. Переименовать app shell, маршруты и навигацию.
3. Переделать экран `Harmonica` в `Melodica`.
4. Переделать `Practice`.
5. Переделать MusicXML auto-transpose, export и settings UI.
6. Переделать Note Highway под клавиши мелодики.
7. Подключить мелодичный soundfont после конвертации SFZ в SF2/SF3.
8. Адаптировать `Circle`.
9. Обновить README и внутреннюю документацию.
10. Прогнать тесты, lint и production build.

## Открытый вопрос

Для MusicXML и note-highway нужно выбрать основной формат подсказок:

- названия нот, например `C4`, `D#4`;
- номера клавиш выбранной мелодики, например `1-32`;
- оба режима с переключателем.

Рекомендация: оба режима, с названиями нот по умолчанию.
