# Quiz Scoring Contract V2

## Source of truth

`gradeQuestion()` is the only production switch by question type. `gradeQuiz()` is the only whole-quiz scorer. The Worker owns official score, correctness and stored answer snapshots.

## Supported authoring types

| Type | Canonical student answer | Canonical correct identity | Skipped |
|---|---|---|---|
| MCQ | `{ type, optionId }` | stable option ID | no option ID |
| IMAGE_QUESTION | `{ type, optionId }` | stable option ID | no option ID |
| MULTIPLE_SELECT | `{ type, optionIds }` | sorted unique option IDs | empty array |
| SHORT_ANSWER | `{ type, value }` | normalized accepted text values | empty text |
| TRUE_FALSE | `{ type, values }` | item ID to boolean | missing any item |
| MATCHING | `{ type, pairs }` | left ID to right ID | missing any pair |
| DRAG_DROP | `{ type, values }` | blank ID to value | missing any blank |
| DROPDOWN | `{ type, values }` | blank ID to option value | missing any blank |
| ORDERING | `{ type, ranks }` | item ID to one-based rank | missing/duplicate rank |
| CATEGORIZATION | `{ type, categoriesByItemId }` | item ID to category ID | missing any item |
| UNDERLINE | `{ type, indexes }` | sorted token indexes | empty array |
| WORD_SCRAMBLE | `{ type, letterIndexes }` | letter index sequence | empty array |
| RIDDLE | `{ type, value }` | normalized accepted text values | empty text |
| ERROR_CORRECTION | `{ type, wrongWord, correctWord }` | normalized two-field answer | either field empty |

`GEOMETRY` is not one of the 14 published auto-graded types. Until it has an explicit answer contract, it returns `QUESTION_NOT_AUTO_GRADABLE` and must be blocked at publish.

## Compatibility rules

Legacy answers are accepted only when they map unambiguously:

- Option labels (`A`), indexes, prefixed labels (`A. text`) and unique option content map to stable option IDs.
- Matching accepts `l-N/r-N`, `left-N/right-N` and unique content maps. Duplicate content makes content-based legacy answers invalid.
- Dropdown and drag-drop accept blank ID, raw placeholder token or sequential key when placeholder occurrence and blank order are one-to-one.
- Ordering accepts an ordered array or an object of original item index/ID to one-based rank.
- Stored result wrappers are unwrapped from `selectedAnswer`; client `isCorrect`, score and snapshots are ignored.

## Result contract

Every question returns `correct`, `wrong`, `skipped`, or `invalid`. Invalid question contracts must prevent authoritative persistence; they must never silently produce a zero score.
