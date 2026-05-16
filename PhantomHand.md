# Техническое задание: Модуль «Виртуальная рука-суфлёр»

## Phantom Hand UI — single-hand mode

## 1. Описание задачи

Необходимо заменить или дополнить текущую систему отображения аппликатуры — цифры на падающих нотах — визуальным элементом: **полупрозрачной виртуальной рукой над клавиатурой**.

Модуль предназначен для обучающего приложения в стиле аркадной игры, где ноты падают сверху на виртуальную клавиатуру, а пользователь должен нажимать соответствующие клавиши в момент касания.

Цель модуля — снизить когнитивную нагрузку на пользователя, особенно ребёнка: вместо чтения цифры на падающей ноте пользователь видит, **какой палец нужно подготовить или нажать**.

MVP рассчитан на **одну руку**, по умолчанию правую.

---

# 2. Область MVP

## В рамках MVP

Поддерживается:

```text
одна виртуальная рука
пальцы 1–5
одиночные ноты
аккорды до 5 нот
подсветка пальцев заранее перед нажатием
удержание подсветки во время длинной ноты
переключение режимов подсказок
```

Не входит в MVP:

```text
две руки одновременно
автоматическое определение left/right hand
левая рука с зеркальной аппликатурой
сложная анимация движения кисти по клавиатуре
реалистичная 3D-анимация пальцев
```

Текущий движок `fingerAssigner.ts` считается **single-hand fingering engine**.

---

# 3. Источник данных

Используется существующая функция:

```ts
assignFingers(events, keyCount)
```

Она возвращает массив назначений:

```ts
export type FingerAssignment = {
  eventIndex: number;
  noteIndex: number;
  finger: number; // 1–5
};
```

Номера пальцев:

```text
1 = thumb
2 = index
3 = middle
4 = ring
5 = pinky
```

Для MVP рука считается фиксированной:

```ts
const ACTIVE_HAND = "right";
```

То есть UI всегда подсвечивает пальцы одной виртуальной руки:

```text
finger 1 → right-finger-1
finger 2 → right-finger-2
finger 3 → right-finger-3
finger 4 → right-finger-4
finger 5 → right-finger-5
```

---

# 4. Визуальный элемент

## 4.1. SVG-ассет

Нужно подготовить один SVG-файл руки, вид сверху.

Требования:

```text
формат: SVG
рука: правая рука
стиль: полупрозрачный, мягкий, не отвлекающий от игры
масштабирование: responsive
```

Каждый палец должен быть отдельным SVG-элементом:

```html
<g id="finger-1">...</g>
<g id="finger-2">...</g>
<g id="finger-3">...</g>
<g id="finger-4">...</g>
<g id="finger-5">...</g>
```

Или с префиксом:

```html
<g id="right-finger-1">...</g>
<g id="right-finger-2">...</g>
...
```

Предпочтительный вариант для будущего расширения:

```html
<g id="right-finger-1">
```

---

## 4.2. Визуальные состояния пальца

Каждый палец должен поддерживать минимум 3 состояния:

| State      | Назначение                         | Визуал                                |
| ---------- | ---------------------------------- | ------------------------------------- |
| `idle`     | палец не нужен                     | opacity `0.25–0.4`, серо-белый контур |
| `prepare`  | нота скоро будет нажата            | повышенная яркость, мягкое свечение   |
| `pressing` | нота в зоне нажатия / удерживается | яркая заливка, более сильное свечение |

Пример CSS-логики:

```css
.phantom-finger {
  opacity: 0.35;
  transition: opacity 120ms ease, filter 120ms ease, fill 120ms ease;
}

.phantom-finger.prepare {
  opacity: 0.75;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
}

.phantom-finger.pressing {
  opacity: 1;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.9));
}
```

Цветовая система Судзуки для падающих блоков должна остаться без изменений.

---

# 5. Позиционирование руки

## 5.1. MVP-позиционирование

В первой версии рука может быть статичной.

Расположение:

```text
нижняя часть игрового поля
над виртуальной клавиатурой
слегка поверх задней части клавиш или сразу над ними
не перекрывает hit line полностью
не мешает видеть падающие блоки
```

Рука должна масштабироваться вместе с клавиатурой или игровым контейнером.

---

## 5.2. Необязательное улучшение после MVP

Позже можно добавить динамический сдвиг руки по X на основе `handPos` из аппликатурного движка.

Для этого потребуется расширить результат `assignFingers()` и возвращать `handPos` на уровне группы нот.

Для MVP это не требуется.

---

# 6. Логика подсветки

## 6.1. Time-based warning zone

Палец должен подсвечиваться **заранее**, а не в момент касания ноты клавиатуры.

Рекомендуется использовать временное окно, а не пиксельное.

```ts
const FINGER_HINT_LEAD_TIME_MS = 650;
```

Логика:

```ts
const timeToHit = note.hitTimeMs - currentTimeMs;

if (timeToHit <= FINGER_HINT_LEAD_TIME_MS && timeToHit > 0) {
  state = "prepare";
}

if (note is currently in hit zone or key is being held) {
  state = "pressing";
}

if (note has passed / released) {
  state = "idle";
}
```

Рекомендуемый диапазон:

```text
500–800 ms before hit
```

Можно вынести в настройку позже.

---

## 6.2. Жизненный цикл подсветки

Для каждой ноты:

```text
Enter warning zone
→ finger state = prepare

Note reaches hit zone / user should press
→ finger state = pressing

Note ends / key released / note passed
→ finger state = idle
```

Переход обратно в `idle` должен быть плавным:

```text
transition: 100–200 ms
```

---

## 6.3. Аккорды

Система должна поддерживать одновременную подсветку нескольких пальцев одной руки.

Пример:

```text
C-E-G chord → fingers 1, 3, 5 active simultaneously
```

Максимум для одной руки:

```text
до 5 активных пальцев одновременно
```

Если аккорд содержит больше 5 playable notes, текущий `fingerAssigner.ts` может не вернуть аппликатуру. UI должен безопасно обработать отсутствие подсказки.

---

# 7. Маппинг нот к аппликатуре

Нужно создать быстрый lookup по `eventIndex` и `noteIndex`.

```ts
const assignmentByNote = new Map<string, FingerAssignment>();

for (const assignment of assignments) {
  const key = `${assignment.eventIndex}:${assignment.noteIndex}`;
  assignmentByNote.set(key, assignment);
}
```

При обработке падающего блока:

```ts
const key = `${block.eventIndex}:${block.noteIndex}`;
const assignment = assignmentByNote.get(key);

if (!assignment) {
  return; // no hint for this note
}

const finger = assignment.finger;
```

Затем палец переводится в нужное состояние:

```ts
setFingerState(finger, "prepare");
setFingerState(finger, "pressing");
setFingerState(finger, "idle");
```

---

# 8. Управление состоянием пальцев

Не рекомендуется хранить состояние пальца простым boolean.

Проблема:

```text
несколько нот могут одновременно использовать один и тот же палец
одна нота может закончиться, а другая ещё требует подсветки
```

Лучше использовать счётчики или агрегированное состояние.

Пример:

```ts
type FingerState = "idle" | "prepare" | "pressing";

type FingerRuntimeState = {
  prepareCount: number;
  pressingCount: number;
};
```

И вычислять итоговое состояние:

```ts
function getVisualFingerState(state: FingerRuntimeState): FingerState {
  if (state.pressingCount > 0) return "pressing";
  if (state.prepareCount > 0) return "prepare";
  return "idle";
}
```

Приоритет:

```text
pressing > prepare > idle
```

---

# 9. Производительность

Модуль должен работать без просадки FPS.

Рекомендации:

```text
не изменять SVG DOM каждый кадр без необходимости
сравнивать новое состояние пальцев с предыдущим
обновлять CSS-классы только если состояние изменилось
использовать CSS transition/filter/opacity
не пересоздавать SVG
```

Canvas API не обязателен для MVP. SVG + CSS достаточно, если обновлять только классы.

---

# 10. Настройки UI

В панели настроек нужно заменить текущий чекбокс:

```text
Show Finger Hints
```

на настройку:

```text
Fingering Guide
```

Варианты:

| Value         | Поведение                               |
| ------------- | --------------------------------------- |
| `none`        | подсказки скрыты                        |
| `numbers`     | цифры отображаются на падающих нотах    |
| `virtualHand` | цифры скрыты, включена виртуальная рука |

По умолчанию для детского режима:

```text
virtualHand
```

Для взрослого / debug режима можно оставить:

```text
numbers
```

Опционально для разработки:

```text
debugBoth
```

Поведение:

| Mode          | Numbers on notes | Virtual hand |
| ------------- | ---------------- | ------------ |
| `none`        | hidden           | hidden       |
| `numbers`     | visible          | hidden       |
| `virtualHand` | hidden           | visible      |
| `debugBoth`   | visible          | visible      |

`debugBoth` можно не показывать пользователю, но оставить разработчику.

---

# 11. Ошибки и fallback-поведение

UI не должен падать, если:

```text
для ноты нет FingerAssignment
нота вне диапазона инструмента
аккорд больше 5 нот
assignFingers() вернул []
SVG ещё не загружен
режим подсказок переключили во время игры
```

Ожидаемое поведение:

```text
если нет assignment → не подсвечивать палец
если SVG недоступен → fallback на Numbers или скрыть подсказку
если режим изменился → сбросить все состояния пальцев
```

---

# 12. Definition of Done

Модуль считается готовым, если:

```text
[ ] Добавлен режим Fingering Guide: none / numbers / virtualHand.
[ ] В режиме virtualHand цифры на падающих нотах скрыты.
[ ] Цвета Судзуки на падающих блоках сохранены.
[ ] SVG одной руки интегрирован и масштабируется вместе с игровым полем.
[ ] Каждый палец управляется отдельно через CSS-класс или аналогичный механизм.
[ ] Палец переходит в prepare заранее, примерно за 500–800 мс до касания.
[ ] Палец переходит в pressing в момент нажатия / удержания.
[ ] Палец плавно возвращается в idle после завершения ноты.
[ ] Аккорды подсвечивают несколько пальцев одновременно.
[ ] Повтор одной клавиши не вызывает лишнего мигания пальца.
[ ] При отсутствии FingerAssignment UI не падает.
[ ] При смене режима подсказок состояние руки сбрасывается.
[ ] Реализация не вызывает заметной просадки FPS.
```

---

# 13. Краткая схема работы

```text
MusicXML / PlaybackEvents
        │
        ▼
assignFingers(events, keyCount)
        │
        ▼
FingerAssignment[]
        │
        ▼
assignmentByNote Map(eventIndex:noteIndex)
        │
        ▼
Game loop checks falling notes
        │
        ▼
timeToHit <= leadTime → finger prepare
note in hit zone      → finger pressing
note ended            → finger idle
        │
        ▼
SVG hand updates CSS classes
```

---

# 14. Важное ограничение MVP

Эта версия работает как **single-hand guide**.

Она не должна пытаться автоматически решать, где левая рука, где правая.
Для полноценного пианино с двумя руками потребуется отдельное расширение:

```text
hand detection
left-hand fingering model
right-hand fingering model
two-hand SVG
separate assignments per hand
```

Для текущего MVP всё считается одной рукой, совместимой с текущим `fingerAssigner.ts`.
