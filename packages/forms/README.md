# @repo/forms

Schema + UI for JSON-driven lab forms. Consumed by apps as a workspace
dependency through Next.js `transpilePackages` (the package itself has no build
step — exports point at source).

## Exports

| Entry | Path | What |
| --- | --- | --- |
| `@repo/forms` | `src/index.ts` | Re-exports everything below. |
| `@repo/forms/schema` | `src/schema.ts` | Zod schemas + inferred TS types for every question type, plus `FormDoc`, `ExperimentTemplate`, `FormAnswers`, etc. |
| `@repo/forms/renderer` | `src/FormRenderer.tsx` | Mantine renderer — `FormRenderer` (a whole form), `QuestionField` (one question), `RepeatableGroupField`. |
| `@repo/forms/gallery` | `src/gallery.ts` | `GALLERY` metadata + example questions that drive the docs pages. |
| `@repo/forms/schema.json` | `experiment-template.schema.json` | The JSON Schema (see below). |

## Schema: two artifacts, one source of truth

There are **two** schema artifacts in this package, and they describe the same
shape:

1. **`experiment-template.schema.json`** — a JSON Schema (draft 2020-12). This
   is the **source of truth**. The backend validates and stores templates
   against this same shape, so it is the contract between frontend and backend.

2. **`src/schema.ts`** — Zod schemas, used for runtime validation and to derive
   TypeScript types on the frontend (the renderer, the docs pages, form
   builders). These are **hand-written to mirror** the JSON Schema.

### Why this is acceptable debt

The two are kept in sync **manually** — there is no codegen between them today.
That is deliberate, accepted tech debt: the schema does not change often, so the
cost of a generator (and of debugging its output) outweighs the cost of the
occasional manual edit.

**Rule:** when you change one, change the other. If you add/remove a question
type or a `config` field:

- update `experiment-template.schema.json` (source of truth, backend contract),
- mirror it in `src/schema.ts` (Zod),
- and, if it's a new question type, add a `GALLERY` entry in `src/gallery.ts`
  plus a renderer branch in `src/FormRenderer.tsx`.

The `experiment-template.schema.json` cross-form rule (question `id`s must be
unique across **both** `clientForm` and `labForm`) cannot be expressed in JSON
Schema and is enforced in code.

`examples/full-template.example.json` is a complete template that exercises
every question type — useful as a reference and a fixture.


## Answer validation

`src/validation.ts` is the **single enforcement point** for answers: the same
rules run in the renderer, in the server actions, and in the collaborative
editor's event route, so a value the UI blocks can't be smuggled in by posting
straight to the BFF.

| Export | What |
| --- | --- |
| `validateAnswers(questions, values, opts?)` | Every issue in a whole answer bag. |
| `validateField(questions, field, value, mode?)` | One field (a top-level question id, or a repeatable-group child id whose value is the whole column). `null` when the field belongs to no question. |
| `findMissingRequired(questions, values)` | The `required` subset, unchanged — kept because callers only interested in "what's still blank" read better with it. |
| `describeAnswerIssue(issue)` | English fallback message. Localized apps format `issue.code` + `issue.limit` themselves (`apps/web/src/lib/forms/answerIssues.ts` → `forms.validation.*`). |
| `answerFieldIds(questions)` | Every key an answer may legitimately use. |

Issues are reported as **codes** (`AnswerIssueCode`), never sentences, so the
same validator can render in any locale. Each carries the `path`
(`questionId`, or `groupId.childId[index]` inside a repeatable group) that the
renderer uses to attach the message to the right input.

### What is checked

Whatever the question's `config` declares — `minLength`/`maxLength`, `min`/`max`
(numbers, sliders, ratings, dates), `maxValues`/`maxTags`, option membership for
every choice type — plus the type-level rules a `config` can't express:

- the answer's JavaScript type must match the question type;
- numbers must be finite and within `MAX_SAFE_ANSWER_NUMBER`
  (`Number.MAX_SAFE_INTEGER`) — beyond that a JSON number no longer round-trips
  exactly, so "too big" is a rejection rather than a silently different value;
- `date` / `time` / `datetime` / `color` must be well-formed (and a date must be
  a real calendar day);
- text is capped even with no configured `maxLength`
  (`DEFAULT_MAX_STRING_LENGTH` / `…_TEXTAREA_LENGTH` / `…_PASSWORD_LENGTH`), and
  `tags` by `DEFAULT_MAX_TAGS` / `DEFAULT_MAX_TAG_LENGTH`;
- a repeatable-group column may not be longer than the group's `count`.

### `submit` vs `live` mode

The collaborative lab editor autosaves keystroke-by-keystroke, so validating it
like a submission would reject every half-typed answer. `live` mode therefore
enforces only the constraints a partial answer can never legitimately violate
(wrong type, over a maximum, not an offered option, malformed format —
`isHardIssue`); `required`, `minLength` and `min` are checked only in `submit`
mode, which every path that *commits* a form uses.
